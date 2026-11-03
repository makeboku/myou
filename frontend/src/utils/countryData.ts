export interface CountryInfo {
  code: string;
  name: string;
  englishName: string;
  phoneCountryPrefix: string;
  maleFirstNames: string[];
  femaleFirstNames: string[];
  lastNames: string[];
  cities: string[];
  states: { name: string; abbr: string }[];
  streets: string[];
  streetTypes: string[];
  phoneFormat: () => string;
  zipFormat: () => string;
  titleMale: string;
  titleFemale: string;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function usPhone(): string {
  return `${randomInt(200, 999)}${randomInt(200, 999)}${randomInt(1000, 9999)}`;
}
function usZip(): string {
  return String(randomInt(10000, 99999));
}

function ukPhone(): string {
  return `7${randomInt(100, 999)}${randomInt(100, 999)}${randomInt(100, 999)}`;
}
function ukZip(): string {
  const out = String(randomInt(10, 99)) + " " + String.fromCharCode(65 + randomInt(0, 25)) + String.fromCharCode(65 + randomInt(0, 25));
  return out;
}

function caPhone(): string {
  return `${randomInt(200, 999)}${randomInt(200, 999)}${randomInt(1000, 9999)}`;
}
function caZip(): string {
  const letter = String.fromCharCode(65 + randomInt(0, 25));
  const digit = randomInt(0, 9);
  const letter2 = String.fromCharCode(65 + randomInt(0, 25));
  return `${letter}${digit}${letter2} ${digit}${letter2}${digit}`;
}

function auPhone(): string {
  return `4${randomInt(10, 99)}${randomInt(100, 999)}${randomInt(100, 999)}`;
}
function auZip(): string {
  return String(randomInt(2000, 2999));
}

function jpPhone(): string {
  return `${randomInt(10, 99)}${randomInt(1000, 9999)}${randomInt(1000, 9999)}`;
}
function jpZip(): string {
  return `${String(randomInt(100, 999))}-${String(randomInt(1000, 9999))}`;
}

function dePhone(): string {
  return `${randomInt(100, 999)}${randomInt(100000, 999999)}`;
}
function deZip(): string {
  return String(randomInt(10000, 99999));
}

function frPhone(): string {
  return `${randomInt(6, 7)}${String(randomInt(10, 99))}${String(randomInt(10, 99))}${String(randomInt(10, 99))}${String(randomInt(10, 99))}`;
}
function frZip(): string {
  return String(randomInt(10000, 99999));
}

function sgPhone(): string {
  return `${randomInt(1000, 9999)}${randomInt(1000, 9999)}`;
}
function sgZip(): string {
  return String(randomInt(100000, 999999));
}

function krPhone(): string {
  return `${randomInt(10, 11)}${randomInt(1000, 9999)}${randomInt(1000, 9999)}`;
}
function krZip(): string {
  return String(randomInt(10000, 99999));
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: "US",
    name: "美国",
    englishName: "United States",
    phoneCountryPrefix: "1",
    maleFirstNames: [
      "Benjamin", "Matthew", "Alexander", "Andrew", "Samuel", "Ethan", "Daniel", "Anthony", "Henry", "Joseph",
      "David", "Lucas", "Ian", "Ryan", "Nathan", "Adrian", "Kyle", "Tyler", "Aaron", "Brandon",
      "John", "Michael", "William", "James", "Christopher", "Richard", "Charles", "Caleb", "Leo", "Oscar",
      "Julian", "Austin", "Jeremiah", "Evan", "Peter", "Zachary", "Gabriel", "Wesley", "Jude", "Maxwell",
      "Joshua", "Nicholas", "Adam", "Dominic", "Oliver", "Sebastian", "Justin", "Christian", "Elijah", "Cameron"
    ],
    femaleFirstNames: [
      "Emma", "Olivia", "Ava", "Isabella", "Sophia", "Mia", "Amelia", "Harper", "Evelyn", "Abigail",
      "Ella", "Scarlett", "Grace", "Chloe", "Victoria", "Riley", "Aria", "Lily", "Aubrey", "Zoe",
      "Mary", "Jennifer", "Linda", "Elizabeth", "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa",
      "Penelope", "Camila", "Addison", "Leah", "Lucy", "Bailey", "Caroline", "Stella", "Julia", "Samantha"
    ],
    lastNames: [
      "Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor",
      "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson",
      "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "Hernandez", "King"
    ],
    cities: [
      "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego",
      "Dallas", "San Jose", "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte", "Indianapolis",
      "San Francisco", "Seattle", "Denver", "Nashville", "Portland", "Miami", "Atlanta", "Boston"
    ],
    states: [
      { abbr: "AL", name: "Alabama" }, { abbr: "AK", name: "Alaska" }, { abbr: "AZ", name: "Arizona" },
      { abbr: "AR", name: "Arkansas" }, { abbr: "CA", name: "California" }, { abbr: "CO", name: "Colorado" },
      { abbr: "CT", name: "Connecticut" }, { abbr: "DE", name: "Delaware" }, { abbr: "FL", name: "Florida" },
      { abbr: "GA", name: "Georgia" }, { abbr: "HI", name: "Hawaii" }, { abbr: "ID", name: "Idaho" },
      { abbr: "IL", name: "Illinois" }, { abbr: "IN", name: "Indiana" }, { abbr: "IA", name: "Iowa" },
      { abbr: "KS", name: "Kansas" }, { abbr: "KY", name: "Kentucky" }, { abbr: "LA", name: "Louisiana" },
      { abbr: "ME", name: "Maine" }, { abbr: "MD", name: "Maryland" }, { abbr: "MA", name: "Massachusetts" },
      { abbr: "MI", name: "Michigan" }, { abbr: "MN", name: "Minnesota" }, { abbr: "MS", name: "Mississippi" },
      { abbr: "MO", name: "Missouri" }, { abbr: "MT", name: "Montana" }, { abbr: "NE", name: "Nebraska" },
      { abbr: "NV", name: "Nevada" }, { abbr: "NH", name: "New Hampshire" }, { abbr: "NJ", name: "New Jersey" },
      { abbr: "NM", name: "New Mexico" }, { abbr: "NY", name: "New York" }, { abbr: "NC", name: "North Carolina" },
      { abbr: "ND", name: "North Dakota" }, { abbr: "OH", name: "Ohio" }, { abbr: "OK", name: "Oklahoma" },
      { abbr: "OR", name: "Oregon" }, { abbr: "PA", name: "Pennsylvania" }, { abbr: "RI", name: "Rhode Island" },
      { abbr: "SC", name: "South Carolina" }, { abbr: "SD", name: "South Dakota" }, { abbr: "TN", name: "Tennessee" },
      { abbr: "TX", name: "Texas" }, { abbr: "UT", name: "Utah" }, { abbr: "VT", name: "Vermont" },
      { abbr: "VA", name: "Virginia" }, { abbr: "WA", name: "Washington" }, { abbr: "WV", name: "West Virginia" },
      { abbr: "WI", name: "Wisconsin" }, { abbr: "WY", name: "Wyoming" }
    ],
    streets: ["Oak", "Maple", "Elm", "Main", "Pine", "Cedar", "Walnut", "Cherry", "Birch", "Willow",
      "Park", "Highland", "Sunset", "River", "Lake", "Hill", "Forest", "Meadow", "Spring", "Church"],
    streetTypes: ["St", "Ave", "Blvd", "Dr", "Ln", "Way", "Rd", "Ct", "Pl", "Cir"],
    phoneFormat: usPhone,
    zipFormat: usZip,
    titleMale: "Mr.",
    titleFemale: "Ms.",
  },
  {
    code: "GB",
    name: "英国",
    englishName: "United Kingdom",
    phoneCountryPrefix: "44",
    maleFirstNames: [
      "Oliver", "George", "Harry", "Noah", "Jack", "Leo", "Oscar", "Charlie", "James", "William",
      "Henry", "Thomas", "Freddie", "Alfie", "Arthur", "Jacob", "Ethan", "Archie", "Joshua", "Alexander",
      "David", "Michael", "Daniel", "Christopher", "Andrew", "Paul", "Mark", "Peter", "Richard", "Edward"
    ],
    femaleFirstNames: [
      "Olivia", "Amelia", "Isla", "Ava", "Mia", "Ivy", "Lily", "Ella", "Grace", "Sophie",
      "Charlotte", "Evie", "Emily", "Freya", "Florence", "Alice", "Sienna", "Poppy", "Jessica", "Daisy",
      "Sarah", "Helen", "Claire", "Laura", "Emma", "Rebecca", "Victoria", "Rachel", "Joanne", "Lucy"
    ],
    lastNames: [
      "Smith", "Jones", "Williams", "Taylor", "Brown", "Davies", "Wilson", "Evans", "Thomas", "Roberts",
      "Johnson", "Walker", "Wright", "Robinson", "Thompson", "White", "Hughes", "Edwards", "Green", "Hall",
      "Wood", "Harris", "Martin", "Jackson", "Clarke", "Clark", "James", "Scott", "Turner", "Hill"
    ],
    cities: [
      "London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Newcastle", "Sheffield", "Bristol",
      "Nottingham", "Leicester", "Southampton", "Portsmouth", "Oxford", "Cambridge", "Edinburgh", "Glasgow",
      "Cardiff", "Belfast", "York", "Brighton", "Bath", "Reading", "Exeter", "Norwich"
    ],
    states: [
      { abbr: "ENG", name: "England" }, { abbr: "SCT", name: "Scotland" },
      { abbr: "WLS", name: "Wales" }, { abbr: "NIR", name: "Northern Ireland" }
    ],
    streets: ["High", "Station", "Church", "Main", "Park", "Mill", "Green", "Victoria", "Queen", "King",
      "George", "York", "London", "Oxford", "Cambridge", "Albert", "Edward", "Russell", "Grove", "Lane"],
    streetTypes: ["St", "Rd", "Ave", "Ln", "Gdns", "Cl", "Dr", "Way", "Pl", "Mews"],
    phoneFormat: ukPhone,
    zipFormat: ukZip,
    titleMale: "Mr.",
    titleFemale: "Ms.",
  },
  {
    code: "CA",
    name: "加拿大",
    englishName: "Canada",
    phoneCountryPrefix: "1",
    maleFirstNames: [
      "Liam", "Noah", "Benjamin", "Ethan", "William", "Lucas", "James", "Oliver", "Henry", "Jack",
      "Alexander", "Jacob", "Daniel", "Logan", "Matthew", "David", "Samuel", "Owen", "Nathan", "Thomas",
      "Michael", "Andrew", "Ryan", "Tyler", "Evan", "Adrian", "Isaac", "Jordan", "Justin", "Brandon"
    ],
    femaleFirstNames: [
      "Emma", "Olivia", "Charlotte", "Amelia", "Sophia", "Mia", "Ava", "Isabella", "Lily", "Ella",
      "Chloe", "Harper", "Grace", "Emily", "Hannah", "Abigail", "Madison", "Scarlett", "Zoe", "Hailey",
      "Evelyn", "Aria", "Layla", "Riley", "Aubrey", "Sofia", "Lucy", "Victoria", "Sarah", "Leah"
    ],
    lastNames: [
      "Smith", "Brown", "Tremblay", "Martin", "Roy", "Wilson", "MacDonald", "Gagnon", "Johnson", "Taylor",
      "Campbell", "Anderson", "Jones", "Wilson", "Moore", "White", "Lee", "Thompson", "Gauthier", "Scott",
      "Morin", "Leblanc", "Clark", "Lavoie", "Fortin", "Ouellet", "Pelletier", "Bouchard", "Cote", "Caron"
    ],
    cities: [
      "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City",
      "Hamilton", "Kitchener", "London", "Halifax", "St. Catharines", "Victoria", "Windsor", "Saskatoon",
      "Regina", "St. John's", "Barrie", "Kelowna", "Abbotsford", "Sherbrooke", "Sudbury", "Trois-Rivieres"
    ],
    states: [
      { abbr: "AB", name: "Alberta" }, { abbr: "BC", name: "British Columbia" },
      { abbr: "MB", name: "Manitoba" }, { abbr: "NB", name: "New Brunswick" },
      { abbr: "NL", name: "Newfoundland and Labrador" }, { abbr: "NS", name: "Nova Scotia" },
      { abbr: "ON", name: "Ontario" }, { abbr: "PE", name: "Prince Edward Island" },
      { abbr: "QC", name: "Quebec" }, { abbr: "SK", name: "Saskatchewan" }
    ],
    streets: ["Maple", "Oak", "Cedar", "Pine", "Birch", "Elm", "Church", "Main", "Queen", "King",
      "Victoria", "Park", "River", "Lake", "Forest", "Highland", "Willow", "Chestnut", "Cherry", "Walnut"],
    streetTypes: ["St", "Ave", "Rd", "Dr", "Blvd", "Ln", "Way", "Ct", "Pl", "Cir"],
    phoneFormat: caPhone,
    zipFormat: caZip,
    titleMale: "Mr.",
    titleFemale: "Ms.",
  },
  {
    code: "AU",
    name: "澳大利亚",
    englishName: "Australia",
    phoneCountryPrefix: "61",
    maleFirstNames: [
      "Oliver", "Noah", "William", "Jack", "James", "Henry", "Lucas", "Ethan", "Leo", "Thomas",
      "Lachlan", "Charlie", "Hugo", "Alexander", "Max", "Benjamin", "Harrison", "Sebastian", "Oscar", "Archie",
      "David", "Michael", "Andrew", "Matthew", "Daniel", "Joshua", "Ryan", "Samuel", "Nathan", "Luke"
    ],
    femaleFirstNames: [
      "Charlotte", "Olivia", "Amelia", "Mia", "Isla", "Ava", "Grace", "Sophie", "Chloe", "Harper",
      "Ella", "Zoe", "Emily", "Lily", "Ruby", "Evelyn", "Sienna", "Sophia", "Ivy", "Willow",
      "Sarah", "Jessica", "Emma", "Lucy", "Hannah", "Georgia", "Mackenzie", "Abigail", "Elizabeth", "Claire"
    ],
    lastNames: [
      "Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Johnson", "White", "Martin", "Anderson",
      "Thompson", "Thomas", "Walker", "Harris", "Roberts", "Davis", "Jackson", "Robinson", "Miller", "Lee",
      "King", "Wright", "Campbell", "Green", "Clarke", "Baker", "Hill", "Mitchell", "Moore", "Carter"
    ],
    cities: [
      "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Newcastle",
      "Wollongong", "Hobart", "Geelong", "Townsville", "Cairns", "Darwin", "Ballarat", "Bendigo",
      "Launceston", "Mackay", "Rockhampton", "Bunbury", "Coffs Harbour", "Toowoomba", "Albury", "Mildura"
    ],
    states: [
      { abbr: "NSW", name: "New South Wales" }, { abbr: "VIC", name: "Victoria" },
      { abbr: "QLD", name: "Queensland" }, { abbr: "WA", name: "Western Australia" },
      { abbr: "SA", name: "South Australia" }, { abbr: "TAS", name: "Tasmania" },
      { abbr: "ACT", name: "Australian Capital Territory" }, { abbr: "NT", name: "Northern Territory" }
    ],
    streets: ["George", "Elizabeth", "King", "Queen", "Park", "Church", "Main", "High", "Victoria", "Albert",
      "Edward", "Sydney", "Brisbane", "Melbourne", "Adelaide", "Perth", "Collins", "Bourke", "Flinders", "Swanston"],
    streetTypes: ["St", "Rd", "Ave", "Dr", "Blvd", "Ln", "Way", "Ct", "Pl", "Pde"],
    phoneFormat: auPhone,
    zipFormat: auZip,
    titleMale: "Mr.",
    titleFemale: "Ms.",
  },
  {
    code: "JP",
    name: "日本",
    englishName: "Japan",
    phoneCountryPrefix: "81",
    maleFirstNames: [
      "Haruto", "Sota", "Yuto", "Riku", "Minato", "Itsuki", "Yamato", "Takumi", "Sora", "Kaito",
      "Hiroshi", "Takeshi", "Kenji", "Satoshi", "Taro", "Ichiro", "Shinji", "Yuki", "Daiki", "Shota",
      "Kazuki", "Ryo", "Koji", "Akira", "Jun", "Makoto", "Noboru", "Isamu", "Osamu", "Hajime"
    ],
    femaleFirstNames: [
      "Himari", "Yui", "Akari", "Sakura", "Mei", "Riko", "Mio", "Rin", "Aoi", "Yuna",
      "Yuki", "Hana", "Aya", "Miyu", "Nao", "Yoshiko", "Keiko", "Rie", "Asuka", "Moe",
      "Saki", "Nana", "Miki", "Eri", "Kana", "Mai", "Chihiro", "Yoko", "Tomoko", "Mari"
    ],
    lastNames: [
      "Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato",
      "Yoshida", "Yamada", "Sasaki", "Yamaguchi", "Matsumoto", "Inoue", "Kimura", "Shimizu", "Hayashi", "Saito",
      "Abe", "Mori", "Ishikawa", "Nakajima", "Ogawa", "Fujita", "Okada", "Hashimoto", "Maeda", "Murakami"
    ],
    cities: [
      "Tokyo", "Osaka", "Yokohama", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto",
      "Kawasaki", "Saitama", "Hiroshima", "Sendai", "Chiba", "Kitakyushu", "Niigata", "Hamamatsu",
      "Kumamoto", "Sagamihara", "Okayama", "Shizuoka", "Kagoshima", "Funabashi", "Matsuyama", "Hachioji"
    ],
    states: [
      { abbr: "HKD", name: "Hokkaido" }, { abbr: "AOM", name: "Aomori" },
      { abbr: "IWT", name: "Iwate" }, { abbr: "MYG", name: "Miyagi" },
      { abbr: "AKT", name: "Akita" }, { abbr: "YGT", name: "Yamagata" },
      { abbr: "FKS", name: "Fukushima" }, { abbr: "IBR", name: "Ibaraki" },
      { abbr: "TCH", name: "Tochigi" }, { abbr: "GNM", name: "Gunma" },
      { abbr: "STM", name: "Saitama" }, { abbr: "CHB", name: "Chiba" },
      { abbr: "TKY", name: "Tokyo" }, { abbr: "KNW", name: "Kanagawa" },
      { abbr: "NGT", name: "Niigata" }, { abbr: "TYM", name: "Toyama" },
      { abbr: "ISK", name: "Ishikawa" }, { abbr: "FKI", name: "Fukui" },
      { abbr: "YMN", name: "Yamanashi" }, { abbr: "NGN", name: "Nagano" },
      { abbr: "GIF", name: "Gifu" }, { abbr: "SZO", name: "Shizuoka" },
      { abbr: "AIC", name: "Aichi" }, { abbr: "MIE", name: "Mie" },
      { abbr: "SIG", name: "Shiga" }, { abbr: "KYO", name: "Kyoto" },
      { abbr: "OSK", name: "Osaka" }, { abbr: "HYG", name: "Hyogo" },
      { abbr: "NAR", name: "Nara" }, { abbr: "WKY", name: "Wakayama" },
      { abbr: "TTR", name: "Tottori" }, { abbr: "SMN", name: "Shimane" },
      { abbr: "OAY", name: "Okayama" }, { abbr: "HSH", name: "Hiroshima" },
      { abbr: "YGC", name: "Yamaguchi" }, { abbr: "TKS", name: "Tokushima" },
      { abbr: "KGW", name: "Kagawa" }, { abbr: "EHM", name: "Ehime" },
      { abbr: "KCH", name: "Kochi" }, { abbr: "FUK", name: "Fukuoka" },
      { abbr: "SAG", name: "Saga" }, { abbr: "NGS", name: "Nagasaki" },
      { abbr: "KMM", name: "Kumamoto" }, { abbr: "OIT", name: "Oita" },
      { abbr: "MYZ", name: "Miyazaki" }, { abbr: "KGS", name: "Kagoshima" },
      { abbr: "OKN", name: "Okinawa" }
    ],
    streets: ["Sakura", "Midori", "Yamato", "Asahi", "Hinode", "Fuji", "Taka", "Naka", "Kita", "Minami",
      "Higashi", "Nishi", "Aoyama", "Ueno", "Ginza", "Shinjuku", "Shibuya", "Ikebukuro", "Akasaka", "Roppongi"],
    streetTypes: ["Cho", "Dori", "Machi", "Ku", "Chome", "Banchi"],
    phoneFormat: jpPhone,
    zipFormat: jpZip,
    titleMale: "Sama",
    titleFemale: "Sama",
  },
  {
    code: "DE",
    name: "德国",
    englishName: "Germany",
    phoneCountryPrefix: "49",
    maleFirstNames: [
      "Felix", "Maximilian", "Leon", "Lukas", "Jonas", "Tim", "Niklas", "Finn", "Julian", "Luis",
      "Paul", "Alexander", "David", "Simon", "Erik", "Jan", "Ben", "Luca", "Tom", "Max",
      "Peter", "Michael", "Thomas", "Andreas", "Stefan", "Christian", "Markus", "Daniel", "Klaus", "Hans"
    ],
    femaleFirstNames: [
      "Emma", "Mia", "Hanna", "Sophie", "Lea", "Lena", "Lina", "Emilia", "Anna", "Lilly",
      "Marie", "Amelie", "Maja", "Nele", "Laura", "Sarah", "Julia", "Lisa", "Katharina", "Sandra",
      "Nicole", "Sabine", "Stefanie", "Melanie", "Heike", "Birgit", "Monika", "Angelika", "Ute", "Renate"
    ],
    lastNames: [
      "Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Schafer", "Koch",
      "Bauer", "Richter", "Klein", "Wolf", "Schroder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Kruger",
      "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier", "Lehmann", "Schmid"
    ],
    cities: [
      "Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Dusseldorf", "Leipzig",
      "Dortmund", "Essen", "Bremen", "Dresden", "Hanover", "Nuremberg", "Duisburg", "Bochum",
      "Bonn", "Munster", "Karlsruhe", "Augsburg", "Wiesbaden", "Aachen", "Braunschweig", "Kiel"
    ],
    states: [
      { abbr: "BW", name: "Baden-Wurttemberg" }, { abbr: "BY", name: "Bavaria" },
      { abbr: "BE", name: "Berlin" }, { abbr: "BB", name: "Brandenburg" },
      { abbr: "HB", name: "Bremen" }, { abbr: "HH", name: "Hamburg" },
      { abbr: "HE", name: "Hesse" }, { abbr: "MV", name: "Mecklenburg-Vorpommern" },
      { abbr: "NI", name: "Lower Saxony" }, { abbr: "NW", name: "North Rhine-Westphalia" },
      { abbr: "RP", name: "Rhineland-Palatinate" }, { abbr: "SL", name: "Saarland" },
      { abbr: "SN", name: "Saxony" }, { abbr: "ST", name: "Saxony-Anhalt" },
      { abbr: "SH", name: "Schleswig-Holstein" }, { abbr: "TH", name: "Thuringia" }
    ],
    streets: ["Haupt", "Schul", "Garten", "Berg", "Wald", "Muhlen", "Kirch", "Dorf", "Ring", "Park",
      "Friedrich", "Goethe", "Schiller", "Bismarck", "Hindenburg", "Berliner", "Munchner", "Leipziger", "Kaiser", "Bahnhof"],
    streetTypes: ["Str", "Weg", "Allee", "Platz", "Ring", "Gasse", "Damm", "Steig", "Bogen", "Hof"],
    phoneFormat: dePhone,
    zipFormat: deZip,
    titleMale: "Herr",
    titleFemale: "Frau",
  },
  {
    code: "FR",
    name: "法国",
    englishName: "France",
    phoneCountryPrefix: "33",
    maleFirstNames: [
      "Gabriel", "Raphael", "Louis", "Arthur", "Jules", "Adam", "Lucas", "Hugo", "Leo", "Paul",
      "Nathan", "Tom", "Mathis", "Mael", "Ethan", "Antoine", "Alexandre", "Pierre", "Nicolas", "Jean",
      "Philippe", "Francois", "Michel", "Christophe", "Laurent", "Olivier", "David", "Stephane", "Sebastien", "Frederic"
    ],
    femaleFirstNames: [
      "Emma", "Louise", "Alice", "Chloe", "Lina", "Rose", "Lea", "Mila", "Lena", "Maeva",
      "Jade", "Manon", "Sarah", "Camille", "Julie", "Marine", "Laura", "Marie", "Sophie", "Isabelle",
      "Celine", "Nathalie", "Elodie", "Audrey", "Amelie", "Pauline", "Emilie", "Virginie", "Helene", "Sandrine"
    ],
    lastNames: [
      "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
      "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
      "Morel", "Girard", "Andre", "Mercier", "Dupont", "Lambert", "Bonnet", "Francois", "Martinez", "Legrand"
    ],
    cities: [
      "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier",
      "Bordeaux", "Lille", "Rennes", "Reims", "Saint-Etienne", "Le Havre", "Toulon", "Grenoble",
      "Dijon", "Angers", "Clermont-Ferrand", "Limoges", "Aix-en-Provence", "Brest", "Tours", "Amiens"
    ],
    states: [
      { abbr: "ARA", name: "Auvergne-Rhone-Alpes" }, { abbr: "BFC", name: "Bourgogne-Franche-Comte" },
      { abbr: "BRE", name: "Brittany" }, { abbr: "CVL", name: "Centre-Val de Loire" },
      { abbr: "COR", name: "Corsica" }, { abbr: "GES", name: "Grand Est" },
      { abbr: "HDF", name: "Hauts-de-France" }, { abbr: "IDF", name: "Ile-de-France" },
      { abbr: "NOR", name: "Normandy" }, { abbr: "NAQ", name: "Nouvelle-Aquitaine" },
      { abbr: "OCC", name: "Occitanie" }, { abbr: "PDL", name: "Pays de la Loire" },
      { abbr: "PAC", name: "Provence-Alpes-Cote d'Azur" }
    ],
    streets: ["Rue de la Republique", "Rue du General", "Avenue de la Liberte", "Boulevard Saint", "Place de la", "Rue des Fleurs", "Chemin du", "Alle des", "Impasse du", "Route de",
      "Rue Victor", "Avenue Jean", "Boulevard Haussmann", "Rue de Rivoli", "Champs-Elysees", "Rue du Faubourg", "Place Vendome", "Rue de la Paix", "Avenue Montaigne", "Boulevard de Sebastopol"],
    streetTypes: ["Rue", "Av", "Bd", "Pl", "Chem", "All", "Imp", "Rte", "Pass", "Sq"],
    phoneFormat: frPhone,
    zipFormat: frZip,
    titleMale: "M.",
    titleFemale: "Mme",
  },
  {
    code: "SG",
    name: "新加坡",
    englishName: "Singapore",
    phoneCountryPrefix: "65",
    maleFirstNames: [
      "Wei Ming", "Jun Wei", "Kai Xiang", "Zhi Hao", "Yi Feng", "Jie Ren", "Yi Zhong", "Wen Hao", "Jian Wei", "Yi Kang",
      "Li Wei", "Jia Ming", "Yun Feng", "Wei Jie", "Sheng Yuan", "Guo Liang", "Hao Ran", "Ming Yang", "Jun Kai", "Yi Yang"
    ],
    femaleFirstNames: [
      "Xin Yi", "Jia Ling", "Mei Ling", "Xiu Ying", "Li Hua", "Yue Ling", "Fang Ning", "Jing Wen", "Pei Qi", "Hui Min",
      "Shu Fen", "Wen Jing", "Xiu Juan", "Li Na", "Yun Xuan", "Ming Zhu", "Ya Ting", "Jia Qi", "Xiao Yun", "Pei Ling"
    ],
    lastNames: [
      "Tan", "Lim", "Lee", "Ng", "Ong", "Wong", "Goh", "Chua", "Chan", "Koh",
      "Teo", "Ang", "Yeo", "Ho", "Low", "Tay", "Toh", "Chia", "Loh", "Sim",
      "Pang", "Seah", "Teh", "Chong", "Neo", "Fong", "Chin", "Liew", "Yong", "Wee"
    ],
    cities: [
      "Singapore"
    ],
    states: [
      { abbr: "CENTRAL", name: "Central" }, { abbr: "EAST", name: "East" },
      { abbr: "NORTH", name: "North" }, { abbr: "NE", name: "North-East" },
      { abbr: "WEST", name: "West" }
    ],
    streets: ["Orchard", "Serangoon", "Bukit Timah", "Thomson", "Dunlop", "Rochor", "Jalan", "Geylang", "Balestier", "Newton",
      "Tanglin", "River Valley", "Holland", "Clementi", "Bedok", "Tampines", "Woodlands", "Jurong", "Pasir", "Toa Payoh"],
    streetTypes: ["Rd", "St", "Ave", "Ln", "Dr", "Way", "Walk", "Link", "Cres", "View"],
    phoneFormat: sgPhone,
    zipFormat: sgZip,
    titleMale: "Mr.",
    titleFemale: "Ms.",
  },
  {
    code: "KR",
    name: "韩国",
    englishName: "South Korea",
    phoneCountryPrefix: "82",
    maleFirstNames: [
      "Min-jun", "Seo-jun", "Ji-ho", "Ha-joon", "Si-woo", "Yun-woo", "Ji-hoon", "Hyun-woo", "Sung-min", "Jae-won",
      "Kyung-ho", "Tae-hyun", "Sang-hyun", "Jin-ho", "Young-ho", "Dong-hyun", "Jung-ho", "Ki-young", "Chang-ho", "Hyung-soo"
    ],
    femaleFirstNames: [
      "Seo-yeon", "Ji-woo", "Ha-yoon", "Ji-yeon", "Min-seo", "Soo-bin", "Eun-ji", "Na-eun", "Ye-ji", "Hyun-ji",
      "Mi-young", "Eun-jung", "Hye-jin", "Kyung-ah", "Sook-hee", "Jung-hee", "Myung-sook", "Young-mi", "Ok-hee", "In-sook"
    ],
    lastNames: [
      "Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim",
      "Han", "Oh", "Shin", "Seo", "Kwon", "Hwang", "Ahn", "Song", "Yoo", "Hong"
    ],
    cities: [
      "Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan",
      "Changwon", "Seongnam", "Goyang", "Yongin", "Bucheon", "Cheongju", "Ansan", "Jeonju",
      "Cheonan", "Namyangju", "Hwaseong", "Pyeongtaek", "Gimhae", "Pohang", "Jeju", "Masan"
    ],
    states: [
      { abbr: "SEO", name: "Seoul" }, { abbr: "BUS", name: "Busan" },
      { abbr: "DAE", name: "Daegu" }, { abbr: "INC", name: "Incheon" },
      { abbr: "GWJ", name: "Gwangju" }, { abbr: "DJN", name: "Daejeon" },
      { abbr: "ULS", name: "Ulsan" }, { abbr: "SEJ", name: "Sejong" },
      { abbr: "GG", name: "Gyeonggi" }, { abbr: "GW", name: "Gangwon" },
      { abbr: "CB", name: "Chungcheongbuk" }, { abbr: "CN", name: "Chungcheongnam" },
      { abbr: "JB", name: "Jeollabuk" }, { abbr: "JN", name: "Jeollanam" },
      { abbr: "GB", name: "Gyeongsangbuk" }, { abbr: "GN", name: "Gyeongsangnam" },
      { abbr: "JJ", name: "Jeju" }
    ],
    streets: ["Jong-ro", "Gangnam-daero", "Teheran-ro", "Eulji-ro", "Sejong-daero", "Yulgok-ro", "Sajik-ro", "Samcheong-ro", "Insadong-gil", "Bukchon-ro",
      "Myeongdong-gil", "Hongdae-gil", "Sinchon-ro", "Apgujeong-ro", "Cheongdam-ro", "Nonhyeon-ro", "Yanghwa-ro", "Mapo-daero", "Wangsimni-ro", "Cheonho-daero"],
    streetTypes: ["Ro", "Gil", "Daero"],
    phoneFormat: krPhone,
    zipFormat: krZip,
    titleMale: "Mr.",
    titleFemale: "Ms.",
  },
];

export function getCountryByCode(code: string): CountryInfo {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
}
