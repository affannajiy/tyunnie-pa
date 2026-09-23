import { describe, it, expect } from "vitest";
import type { Card, Suit } from "../cards";
import * as E from "./engine";

// Cards are drawn from the END of the shoe. `rig("A", "K", ...)` lists them
// in deal order: player, dealer, player, dealer, then hits/dealer draws.
function card(v: string, suit: Suit = "♠"): Card {
  return { suit, value: v, faceUp: false };
}
function rig(...order: string[]): Card[] {
  const filler = Array.from({ length: 60 }, () => card("5", "♣"));
  return [...filler, ...order.map((v) => card(v)).reverse()];
}
function table(order: string[], bankroll = 500): E.Game {
  return { ...E.newTable({ bankroll }), shoe: rig(...order) };
}
function bet(g: E.Game, amount: number) {
  for (const c of [100, 50, 25, 10, 5]) while (amount >= c) { g = E.addChip(g, c); amount -= c; }
  return g;
}
function playDealer(g: E.Game) {
  let n = 0;
  while (g.phase === "dealer" && n++ < 20) g = E.dealerStep(g);
  return g;
}

describe("handTotal", () => {
  it("drops aces from 11 to 1", () => {
    expect(E.handTotal([card("A"), card("A"), card("9")])).toBe(21);
    expect(E.handTotal([card("A"), card("K")])).toBe(21);
    expect(E.handTotal([card("A"), card("6")])).toBe(17);
    expect(E.handTotal([card("A"), card("6"), card("10")])).toBe(17);
  });
  it("isSoft only while an ace still counts 11", () => {
    expect(E.isSoft([card("A"), card("6")])).toBe(true);
    expect(E.isSoft([card("A"), card("6"), card("10")])).toBe(false);
    expect(E.isSoft([card("10"), card("7")])).toBe(false);
  });
});

describe("betting", () => {
  it("stacks chips up to min(maxBet, bankroll) and rejects others", () => {
    let g = E.newTable({ bankroll: 60 });
    g = E.addChip(g, 50);
    expect(g.wager).toBe(50);
    expect(E.addChip(g, 25).wager).toBe(50);   // 75 > bankroll
    expect(E.addChip(g, 7).wager).toBe(50);    // not a chip
    g = E.addChip(g, 10);
    expect(g.wager).toBe(60);
    expect(E.canDeal(g)).toBe(true);
  });
  it("needs the table minimum", () => {
    const g = E.addChip(E.newTable(), 5);
    expect(E.canDeal(g)).toBe(false);
    expect(E.deal(g).phase).toBe("betting");
  });
  it("rebet restores the last wager, doubleBet caps at max", () => {
    let g = bet(E.newTable(), 25);
    g = E.nextRound(playDealer(E.stand(E.deal({ ...g, shoe: rig("9", "9", "9", "9") }))));
    expect(g.wager).toBe(0);
    expect(E.rebet(g).wager).toBe(25);
    g = bet(g, 300);
    expect(E.doubleBet(g).wager).toBe(500);
  });
  it("rebuy only when broke, tracked in stats", () => {
    const rich = E.newTable({ bankroll: 100 });
    expect(E.rebuy(rich)).toBe(rich);
    const broke = E.newTable({ bankroll: 5 });
    const g = E.rebuy(broke);
    expect(g.bankroll).toBe(E.RULES.startBankroll);
    expect(g.stats.rebuys).toBe(1);
  });
});

describe("deal + naturals", () => {
  it("takes the wager off the bankroll and moves to player phase", () => {
    const g = E.deal(bet(table(["9", "7", "8", "6"]), 25));
    expect(g.phase).toBe("player");
    expect(g.bankroll).toBe(475);
    expect(g.lastWager).toBe(25);
    expect(g.hands[0].cards.map((c) => c.value)).toEqual(["9", "8"]);
    expect(g.dealer.map((c) => c.faceUp)).toEqual([true, false]);
  });
  it("player blackjack pays 3:2 immediately", () => {
    const g = E.deal(bet(table(["A", "7", "K", "6"]), 20));
    expect(g.phase).toBe("settled");
    expect(g.hands[0].result).toBe("blackjack");
    expect(g.bankroll).toBe(530);
    expect(g.roundNet).toBe(30);
    expect(g.stats.blackjacks).toBe(1);
  });
  it("dealer peeks on a ten: dealer blackjack loses the round before any action", () => {
    const g = E.deal(bet(table(["9", "K", "8", "A"]), 25));
    expect(g.phase).toBe("settled");
    expect(g.hands[0].result).toBe("lose");
    expect(g.bankroll).toBe(475);
  });
  it("both blackjack = push", () => {
    const g = E.deal(bet(table(["A", "K", "K", "A"]), 25));
    expect(g.phase).toBe("settled");
    expect(g.hands[0].result).toBe("push");
    expect(g.bankroll).toBe(500);
  });
});

describe("insurance", () => {
  it("is offered on a dealer ace, pays 2:1 on dealer blackjack", () => {
    let g = E.deal(bet(table(["9", "A", "8", "K"]), 50));
    expect(g.phase).toBe("insurance");
    g = E.takeInsurance(g);
    expect(g.phase).toBe("settled");
    expect(g.insurance).toBe(25);
    expect(g.insuranceWon).toBe(true);
    // lost 50 on the hand, won 50 on insurance
    expect(g.bankroll).toBe(500);
    expect(g.roundNet).toBe(0);
    expect(g.stats.insurances).toBe(1);
  });
  it("loses the side bet when the dealer has no blackjack", () => {
    let g = E.deal(bet(table(["9", "A", "8", "6"]), 50));
    g = E.takeInsurance(g);
    expect(g.phase).toBe("player");
    expect(g.bankroll).toBe(425);
    expect(g.insuranceWon).toBe(null);
  });
  it("declining goes straight to the peek", () => {
    const g = E.declineInsurance(E.deal(bet(table(["9", "A", "8", "K"]), 50)));
    expect(g.phase).toBe("settled");
    expect(g.bankroll).toBe(450);
  });
  it("even money: blackjack vs ace with insurance nets exactly the bet either way", () => {
    const bj = E.takeInsurance(E.deal(bet(table(["A", "A", "K", "K"]), 40)));
    expect(bj.hands[0].result).toBe("push");
    expect(bj.roundNet).toBe(40);
    const noBj = E.takeInsurance(E.deal(bet(table(["A", "A", "K", "5"]), 40)));
    expect(noBj.hands[0].result).toBe("blackjack");
    expect(noBj.roundNet).toBe(40);
  });
});

describe("hit / stand / dealer", () => {
  it("bust settles without the dealer drawing", () => {
    let g = E.deal(bet(table(["9", "7", "8", "6", "K"]), 25));
    g = E.hit(g);
    expect(g.phase).toBe("settled");
    expect(g.hands[0].status).toBe("busted");
    expect(g.dealer.length).toBe(2);
    expect(g.dealer[1].faceUp).toBe(true);
    expect(g.bankroll).toBe(475);
    expect(g.stats.busts).toBe(1);
  });
  it("hitting to 21 auto-stands", () => {
    const g = E.hit(E.deal(bet(table(["9", "7", "8", "6", "4"]), 25)));
    expect(g.phase).toBe("dealer");
    expect(g.hands[0].status).toBe("stood");
  });
  it("dealer draws to 17 and stands on soft 17", () => {
    // player 20; dealer A 6 = soft 17 → stands
    let g = E.stand(E.deal(bet(table(["K", "A", "Q", "6"]), 25)));
    g = E.declineInsurance(g);
    g = playDealer(E.stand(g));
    expect(g.dealer.length).toBe(2);
    expect(g.hands[0].result).toBe("win");
    expect(g.bankroll).toBe(525);
  });
  it("dealer hits hard 16 and busts", () => {
    let g = E.stand(E.deal(bet(table(["K", "9", "8", "7", "K"]), 25)));
    g = playDealer(g);
    expect(E.handTotal(g.dealer)).toBe(26);
    expect(g.hands[0].result).toBe("win");
  });
  it("push returns the bet", () => {
    const g = playDealer(E.stand(E.deal(bet(table(["K", "9", "9", "K"]), 25))));
    expect(g.hands[0].result).toBe("push");
    expect(g.bankroll).toBe(500);
    expect(g.stats.pushes).toBe(1);
  });
});

describe("double", () => {
  it("doubles the bet, takes one card, stands", () => {
    let g = E.deal(bet(table(["5", "7", "6", "K", "9", "8"]), 25));
    expect(E.canDouble(g)).toBe(true);
    g = E.double(g);
    expect(g.hands[0].bet).toBe(50);
    expect(g.hands[0].doubled).toBe(true);
    expect(g.hands[0].cards.length).toBe(3);
    expect(g.phase).toBe("dealer");
    g = playDealer(g);
    // player 20 vs dealer 17+8=25 bust
    expect(g.hands[0].result).toBe("win");
    expect(g.bankroll).toBe(550);
    expect(g.stats.doubles).toBe(1);
  });
  it("is refused after a hit and when the bankroll is short", () => {
    const g = E.hit(E.deal(bet(table(["5", "7", "6", "K", "2"]), 25)));
    expect(E.canDouble(g)).toBe(false);
    const poor = E.deal(bet(table(["5", "7", "6", "K"], 30), 25));
    expect(E.canDouble(poor)).toBe(false);
  });
});

describe("split", () => {
  it("splits a pair into two hands, deals each a second card lazily", () => {
    // 8 8 vs 6; hand1 gets K (stand), hand2 gets 3 → hit 10 (21), dealer draws 9 → 15+... rig accordingly
    let g = E.deal(bet(table(["8", "6", "8", "9", "K", "3", "10", "5"]), 25));
    expect(E.canSplit(g)).toBe(true);
    g = E.split(g);
    expect(g.hands.length).toBe(2);
    expect(g.bankroll).toBe(450);
    expect(g.hands[0].cards.map((c) => c.value)).toEqual(["8", "K"]);
    expect(g.hands[1].cards.length).toBe(1);
    expect(g.active).toBe(0);
    g = E.stand(g);
    expect(g.active).toBe(1);
    expect(g.hands[1].cards.map((c) => c.value)).toEqual(["8", "3"]);
    g = E.hit(g); // 21 → auto-stand → dealer
    expect(g.phase).toBe("dealer");
    g = playDealer(g);
    expect(E.handTotal(g.dealer)).toBe(20); // 6+9+5
    expect(g.hands[0].result).toBe("lose");
    expect(g.hands[1].result).toBe("win");
    expect(g.bankroll).toBe(500);
    expect(g.stats.splits).toBe(1);
    expect(g.stats.hands).toBe(2);
  });
  it("splits ten-value cards of different rank", () => {
    const g = E.deal(bet(table(["K", "6", "Q", "9"]), 25));
    expect(E.canSplit(g)).toBe(true);
  });
  it("split aces get one card each and a 21 is not a natural", () => {
    let g = E.deal(bet(table(["A", "6", "A", "9", "K", "5", "K"]), 25));
    g = E.split(g);
    // both hands auto-stood; dealer 6+9=15 draws K → 25 bust
    expect(g.phase).toBe("dealer");
    expect(g.hands.map((h) => h.status)).toEqual(["stood", "stood"]);
    g = playDealer(g);
    expect(g.hands[0].result).toBe("win");
    expect(g.hands[0].payout).toBe(50); // 1:1, not 3:2
    expect(g.hands[1].result).toBe("win");
    expect(g.bankroll).toBe(550);
  });
  it("stops at four hands and needs the bankroll", () => {
    let g = E.deal(bet(table(["8", "6", "8", "9", "8", "8", "8", "8", "8"]), 25));
    g = E.split(g); // hands: [8,8] [8]
    g = E.split(g); // [8,8] [8] [8]
    g = E.split(g); // [8,8] [8] [8] [8]
    expect(g.hands.length).toBe(4);
    expect(E.canSplit(g)).toBe(false);
    const poor = E.deal(bet(table(["8", "6", "8", "9"], 40), 25));
    expect(E.canSplit(poor)).toBe(false);
  });
  it("double after split is allowed", () => {
    let g = E.split(E.deal(bet(table(["5", "6", "5", "9", "6", "K"]), 25)));
    expect(E.canDouble(g)).toBe(true);
    g = E.double(g);
    expect(g.hands[0].bet).toBe(50);
    expect(g.active).toBe(1);
  });
  it("all split hands busting skips the dealer draw", () => {
    let g = E.split(E.deal(bet(table(["8", "6", "8", "9", "K", "K", "K", "K"]), 25)));
    g = E.hit(g); // 8 K K bust
    g = E.hit(g); // 8 K K bust
    expect(g.phase).toBe("settled");
    expect(g.dealer.length).toBe(2);
    expect(g.bankroll).toBe(450);
  });
});

describe("shoe", () => {
  it("reshuffles on the deal after the cut card", () => {
    let g = { ...E.newTable(), dealt: Math.floor(E.SHOE_SIZE * E.RULES.penetration) - 1, shoe: rig("9", "7", "8", "6") };
    g = E.deal(bet(g, 25));
    expect(g.needsShuffle).toBe(true);
    g = E.nextRound(playDealer(E.stand(g)));
    const g2 = E.deal(bet(g, 25));
    expect(g2.events[0]).toEqual({ type: "shuffle" });
    expect(g2.shoe.length).toBe(E.SHOE_SIZE - 4);
    expect(g2.dealt).toBe(4);
    expect(g2.needsShuffle).toBe(false);
  });
  it("shoeRemaining is 1 fresh and 0 at the cut", () => {
    expect(E.shoeRemaining(E.newTable())).toBe(1);
    expect(E.shoeRemaining({ ...E.newTable(), dealt: 999 })).toBe(0);
  });
  it("is deterministic with an rng", () => {
    let i = 0;
    const rng = () => ((i += 7919) % 1000) / 1000;
    const a = E.buildShoe(rng).map((c) => c.value + c.suit).join("");
    i = 0;
    const b = E.buildShoe(rng).map((c) => c.value + c.suit).join("");
    expect(a).toBe(b);
  });
});

describe("stats + events", () => {
  it("tracks streaks and biggest win across rounds", () => {
    let g = E.newTable();
    const win = ["K", "9", "9", "8"];
    for (let r = 0; r < 3; r++) {
      g = E.nextRound(playDealer(E.stand(E.deal(bet({ ...g, shoe: rig(...win) }, 50)))));
    }
    expect(g.stats.streak).toBe(3);
    expect(g.stats.longestStreak).toBe(3);
    expect(g.stats.biggestWin).toBe(50);
    g = E.nextRound(playDealer(E.stand(E.deal(bet({ ...g, shoe: rig("9", "K", "8", "9") }, 50)))));
    expect(g.stats.streak).toBe(-1);
    expect(g.stats.wins).toBe(3);
    expect(g.stats.losses).toBe(1);
  });
  it("events are replaced per transition and settle ends with reveal + settle", () => {
    let g = E.deal(bet(table(["9", "7", "8", "6", "K"]), 25));
    expect(g.events.filter((e) => e.type === "card").length).toBe(4);
    g = E.hit(g);
    const types = g.events.map((e) => e.type);
    expect(types).toEqual(["card", "bust", "reveal", "settle"]);
    g = E.nextRound(g);
    expect(g.events).toEqual([]);
  });
  it("tick bumps on every transition and not on refused ones", () => {
    const g = E.newTable();
    expect(E.hit(g)).toBe(g);
    expect(E.addChip(g, 25).tick).toBe(g.tick + 1);
  });
});
