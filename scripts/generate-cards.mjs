#!/usr/bin/env node

// 生成固定前缀的 16 位虚拟信用卡，每次随机选取一种前缀，后缀随机
// 输出格式: 卡号|月|年|CVV  例如: 6227595310871473|01|2026|600
// 卡号经过 Luhn 校验，保证通过基本信用卡账号验证

import { readFileSync } from "node:fs";

const BINS = ["601121255660", "546775142533", "622759531087", "479229938031"];
const CARD_LENGTH = 16;

function luhnCheck(numStr) {
  let sum = 0;
  let double = false;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let d = numStr.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function luhnCheckDigit(partial) {
  for (let d = 0; d < 10; d++) {
    if (luhnCheck(partial + d)) return d;
  }
  return 0;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCardNumber() {
  const bin = BINS[randomInt(0, BINS.length - 1)];
  const randomDigits = 3;
  let suffix = "";
  for (let i = 0; i < randomDigits; i++) suffix += randomInt(0, 9);
  const partial = bin + suffix;
  return partial + luhnCheckDigit(partial);
}

function randomMonth() {
  return String(randomInt(1, 12)).padStart(2, "0");
}

function randomYear() {
  const now = new Date().getFullYear();
  return randomInt(now, now + 10);
}

function randomCvv() {
  return String(randomInt(100, 999));
}

function generateCard() {
  return `${randomCardNumber()}|${randomMonth()}|${randomYear()}|${randomCvv()}`;
}

function usage() {
  console.log("用法:");
  console.log("  node scripts/generate-cards.mjs [数量]     生成指定数量的卡（默认 10）");
  console.log("  node scripts/generate-cards.mjs --verify   校验标准输入中的卡号是否通过 Luhn 验证");
  console.log("  node scripts/generate-cards.mjs --self-test  自检：校验生成的卡号全部有效");
  process.exit(0);
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  usage();
}

if (args.includes("--verify")) {
  const input = readFileSync(0, "utf8").trim();
  if (!input) {
    console.log("没有输入。请通过管道传入卡号，例如：echo 6227595310871473 | node scripts/generate-cards.mjs --verify");
    process.exit(1);
  }
  for (const line of input.split(/\r?\n/)) {
    const num = line.split("|")[0].replace(/\s+/g, "");
    if (!/^\d+$/.test(num)) {
      console.log(`${line}\t=> 无效（非数字）`);
    } else {
      console.log(`${line}\t=> ${luhnCheck(num) ? "有效" : "无效"}`);
    }
  }
  process.exit(0);
}

if (args.includes("--self-test")) {
  let ok = true;
  for (let i = 0; i < 10000; i++) {
    const num = randomCardNumber();
    const startsWithAny = BINS.some((bin) => num.startsWith(bin));
    if (num.length !== CARD_LENGTH || !startsWithAny || !luhnCheck(num)) {
      ok = false;
      console.log("失败:", num);
      break;
    }
  }
  console.log(ok ? "自检通过：生成的卡号全部符合 Luhn 校验" : "自检失败");
  process.exit(ok ? 0 : 1);
}

const countArg = args.find((a) => /^\d+$/.test(a));
const count = countArg ? parseInt(countArg, 10) : 10;
const clamped = Math.max(1, Math.min(count, 100000));

for (let i = 0; i < clamped; i++) {
  console.log(generateCard());
}
