export const universalRouterAbi = [
  {
    name: "execute",
    type: "function",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;
