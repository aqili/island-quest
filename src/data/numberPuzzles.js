/**
 * numberPuzzles.js
 * Number sequences for the Numbers Castle challenge.
 * Each puzzle has 6 numbers to collect in ascending order.
 */

export const NUMBER_PUZZLES = [
  { name: "COUNT",    numbers: [1, 2, 3, 4, 5, 6],        hint: "Count from 1 to 6!" },
  { name: "EVENS",    numbers: [2, 4, 6, 8, 10, 12],       hint: "Even numbers — count by 2!" },
  { name: "THREES",   numbers: [3, 6, 9, 12, 15, 18],      hint: "Multiples of 3!" },
  { name: "FIVES",    numbers: [5, 10, 15, 20, 25, 30],    hint: "Multiples of 5!" },
  { name: "SQUARES",  numbers: [1, 4, 9, 16, 25, 36],      hint: "Square numbers!" },
  { name: "TENS",     numbers: [10, 20, 30, 40, 50, 60],   hint: "Multiples of 10!" },
  { name: "ODDS",     numbers: [1, 3, 5, 7, 9, 11],        hint: "Odd numbers — count by 2 starting at 1!" },
  { name: "FOURS",    numbers: [4, 8, 12, 16, 20, 24],     hint: "Multiples of 4!" },
  { name: "SIXES",    numbers: [6, 12, 18, 24, 30, 36],    hint: "Multiples of 6!" },
  { name: "SEVENS",   numbers: [7, 14, 21, 28, 35, 42],    hint: "Multiples of 7!" },
  { name: "EIGHTS",   numbers: [8, 16, 24, 32, 40, 48],    hint: "Multiples of 8!" },
  { name: "NINES",    numbers: [9, 18, 27, 36, 45, 54],    hint: "Multiples of 9!" },
  { name: "PRIMES",   numbers: [2, 3, 5, 7, 11, 13],       hint: "Prime numbers!" },
  { name: "DOUBLES",  numbers: [1, 2, 4, 8, 16, 32],       hint: "Each number doubles!" },
  { name: "TRIANGLES", numbers: [1, 3, 6, 10, 15, 21],     hint: "Triangle numbers!" },
  { name: "CUBES",    numbers: [1, 8, 27, 64, 125, 216],   hint: "Cube numbers!" },
];
