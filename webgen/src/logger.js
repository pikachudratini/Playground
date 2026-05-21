const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const paint = (code, text) => (useColor ? `[${code}m${text}[0m` : text);

export const c = {
  dim: (t) => paint('2', t),
  bold: (t) => paint('1', t),
  red: (t) => paint('31', t),
  green: (t) => paint('32', t),
  yellow: (t) => paint('33', t),
  blue: (t) => paint('34', t),
  magenta: (t) => paint('35', t),
  cyan: (t) => paint('36', t),
};

let stepNo = 0;

export const log = {
  step(title) {
    stepNo += 1;
    process.stdout.write(`\n${c.bold(c.cyan(`▸ ${stepNo}. ${title}`))}\n`);
  },
  info(msg) {
    process.stdout.write(`  ${msg}\n`);
  },
  detail(label, value) {
    process.stdout.write(`  ${c.dim(label.padEnd(12))} ${value}\n`);
  },
  ok(msg) {
    process.stdout.write(`  ${c.green('✔')} ${msg}\n`);
  },
  warn(msg) {
    process.stdout.write(`  ${c.yellow('!')} ${msg}\n`);
  },
  mock(msg) {
    process.stdout.write(`  ${c.yellow('◇ mock')} ${c.dim(msg)}\n`);
  },
  live(msg) {
    process.stdout.write(`  ${c.magenta('◆ live')} ${msg}\n`);
  },
  error(msg) {
    process.stderr.write(`  ${c.red('✘')} ${msg}\n`);
  },
  resetSteps() {
    stepNo = 0;
  },
};
