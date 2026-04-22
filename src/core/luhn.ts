export function luhnCheckDigit(numStr: string): string {
  let sum = 0;
  let shouldDouble = true;
  for (let i = numStr.length - 1; i >= 0; i -= 1) {
    let n = Number(numStr[i]);
    if (shouldDouble) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    shouldDouble = !shouldDouble;
  }
  return String((10 - (sum % 10)) % 10);
}

