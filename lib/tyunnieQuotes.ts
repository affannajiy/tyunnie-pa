export const TYUNNIE_QUOTES: string[] = [
  "I think the best inventions are ramen and Febreze.",
  "I am Korean Eminem.",
  "Bring me the hammer.",
  "I don't have emotions, I have concepts.",
  "I like resting, but resting makes me want to rest more.",
  "I want to eat everything, but I also want to do nothing.",
  "My hobby is worrying.",
  "Sleep is the best content.",
  "Can we just not.",
  "I think about food a lot. That's it. That's the thought.",
  "Existing is tiring but here we are.",
  "I have a lot of thoughts about nothing specific.",
  "I was born tired.",
  "Effort is something I consider occasionally.",
  "The floor is calling and I must go.",
  "I don't procrastinate. I just do things later.",
  "Why rush when you can just not.",
  "I am at peace with being confused.",
  "Maybe the real ramen was the friends we made along the way.",
  "I will rest. And then I will rest again.",
];

export function getRandomQuote(): string {
  return TYUNNIE_QUOTES[Math.floor(Math.random() * TYUNNIE_QUOTES.length)];
}

export function getCyclingQuote(index: number): string {
  return TYUNNIE_QUOTES[index % TYUNNIE_QUOTES.length];
}
