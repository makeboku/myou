import { getCountryByCode } from './countryData';
import { getRealAddress, fetchRandomUser } from './addressService';

const COMPANIES = [
  "TechCorp", "DataStream", "CloudBase", "NexGen", "OmniTech", "Cyberdyne", "FusionWare",
  "Apex Systems", "BlueBridge", "CoreLogic", "Delta Group", "Eagle Eye", "FirstPoint",
  "GlobalNet", "Horizon Inc", "IronClad", "Junction", "Kinetix", "LexisNexis", "Matrix"
];

const OCCUPATIONS = [
  "Software Engineer", "Data Analyst", "Project Manager", "Marketing Specialist",
  "Financial Analyst", "Operations Manager", "Sales Representative", "Graphic Designer",
  "Accountant", "Consultant", "IT Manager", "Business Analyst", "Registered Nurse",
  "Teacher", "Electrical Engineer", "Mechanical Engineer", "Lawyer", "Pharmacist"
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBirthdayYear(): number {
  return randomInt(1985, 2008);
}

function randomBirthday(year?: number): string {
  const y = year ?? randomBirthdayYear();
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

function generateSSN(): string {
  const parts = [
    String(randomInt(1, 899)).padStart(3, "0"),
    String(randomInt(1, 99)).padStart(2, "0"),
    String(randomInt(1, 9999)).padStart(4, "0")
  ];
  return parts.join("-");
}

function generateCreditCardNumber(): { number: string; type: string } {
  const CARD_BINS = ["601121255660", "546775142533", "622759531087", "479229938031"];
  const cardBin = CARD_BINS[randomInt(0, CARD_BINS.length - 1)];
  const cardType = cardBin.startsWith("6011") ? "Discover" : cardBin.startsWith("5467") ? "Mastercard" : cardBin.startsWith("6227") ? "UnionPay" : "Visa";
  const middle = String(randomInt(0, 999)).padStart(3, "0");
  const partial = cardBin + middle;
  const checkDigit = (10 - (luhnCheckSum(partial + "0") % 10)) % 10;
  const full = partial + checkDigit;
  return { number: full.match(/.{1,4}/g)!.join(" "), type: cardType };
}

function luhnCheckSum(numStr: string): number {
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
  return sum;
}

function generateExpiry(): string {
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const year = String(randomInt(26, 30));
  return `${month}/${year}`;
}

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const length = Math.floor(Math.random() * 11) + 25;
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export interface RandomName {
  countryCode: string;
  countryName: string;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  isMale: boolean;
  gender: string;
  birthday: string;
  streetAddress: string;
  city: string;
  state: string;
  stateFull: string;
  zipCode: string;
  telephone: string;
  fullAddress: string;
  title: string;
  company: string;
  occupation: string;
  ssn: string;
  creditCardType: string;
  creditCardNumber: string;
  cvv2: string;
  expires: string;
  password: string;
}

export function generateRandomName(countryCode?: string): RandomName {
  const country = countryCode ? getCountryByCode(countryCode) : getCountryByCode("US");

  const isMale = Math.random() < 0.5;
  const firstName = isMale ? pick(country.maleFirstNames) : pick(country.femaleFirstNames);
  const lastName = pick(country.lastNames);
  const fullName = `${firstName} ${lastName}`;
  const birthYear = randomBirthdayYear();
  const username = `${firstName}${lastName}`.toLowerCase() + birthYear;

  const stateData = pick(country.states);
  const streetNum = randomInt(100, 9999);
  const streetName = pick(country.streets);
  const streetType = pick(country.streetTypes);
  const streetAddress = `${streetNum} ${streetName} ${streetType}`;
  const city = pick(country.cities);
  const zipCode = country.zipFormat();
  const telephone = `+${country.phoneCountryPrefix}${country.phoneFormat()}`;
  const fullAddress = `${streetAddress}\n${city}, ${stateData.abbr} ${zipCode}\n${country.englishName}`;
  const title = isMale ? country.titleMale : country.titleFemale;
  const gender = isMale ? "Male" : "Female";
  const birthday = randomBirthday(birthYear);
  const company = pick(COMPANIES);
  const occupation = pick(OCCUPATIONS);
  const ssn = generateSSN();
  const creditCard = generateCreditCardNumber();
  const cvv2 = String(randomInt(100, 999));
  const expires = generateExpiry();
  const password = generatePassword();

  return {
    countryCode: country.code,
    countryName: country.name,
    firstName, lastName, fullName, username, isMale,
    gender, birthday, streetAddress, city,
    state: stateData.abbr, stateFull: stateData.name,
    zipCode, telephone, fullAddress, title, company, occupation,
    ssn, creditCardType: creditCard.type, creditCardNumber: creditCard.number, cvv2, expires, password
  };
}

export async function generateFromOSM(countryCode?: string): Promise<RandomName | null> {
  const code = countryCode || "US";
  const country = getCountryByCode(code);

  const city = pick(country.cities);
  const addressData = await getRealAddress(city, country.englishName);
  if (!addressData) return null;

  const userData = await fetchRandomUser(code);
  const isMale = userData?.gender === "male";

  const firstName = userData?.name.first || (isMale ? pick(country.maleFirstNames) : pick(country.femaleFirstNames));
  const lastName = userData?.name.last || pick(country.lastNames);
  const fullName = `${firstName} ${lastName}`;
  const birthYear = randomBirthdayYear();
  const username = `${firstName}${lastName}`.toLowerCase() + birthYear;

  const stateData = country.states.find(s =>
    addressData.stateFull.toLowerCase().includes(s.name.toLowerCase())
  );
  const stateAbbr = stateData?.abbr || addressData.stateFull;

  const telephone = `+${country.phoneCountryPrefix}${country.phoneFormat()}`;
  const fullAddress = `${addressData.streetAddress}\n${addressData.city}, ${stateAbbr} ${addressData.zipCode}\n${country.englishName}`;

  return {
    countryCode: code,
    countryName: country.name,
    firstName,
    lastName,
    fullName,
    username,
    isMale,
    gender: isMale ? "Male" : "Female",
    birthday: randomBirthday(birthYear),
    streetAddress: addressData.streetAddress,
    city: addressData.city,
    state: stateAbbr,
    stateFull: addressData.stateFull,
    zipCode: addressData.zipCode,
    telephone,
    fullAddress,
    title: isMale ? country.titleMale : country.titleFemale,
    company: pick(COMPANIES),
    occupation: pick(OCCUPATIONS),
    ssn: userData?.id?.value || generateSSN(),
    creditCardType: generateCreditCardNumber().type,
    creditCardNumber: generateCreditCardNumber().number,
    cvv2: String(randomInt(100, 999)),
    expires: generateExpiry(),
    password: generatePassword(),
  };
}
