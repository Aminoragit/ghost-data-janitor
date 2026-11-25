import { recordsToCsv } from "./csv";
import type { DataRecord } from "./types";

/**
 * Demo dataset: 45 records — 30 healthy, 6 duplicates (3 exact, 3 fuzzy),
 * 5 ghosts, 4 anomalies. Dates are generated relative to "today" so the
 * 89/91-day ghost boundary cases never rot.
 */
export function sampleRecords(now: Date = new Date()): DataRecord[] {
  const iso = (daysAgo: number) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  const rec = (
    id: string,
    name: string,
    email: string,
    phone: string,
    lastLoginDays: number,
    status: string,
    createdDays: number,
    loginCount: number,
  ): DataRecord => ({
    id,
    name,
    email,
    phone,
    last_login: iso(lastLoginDays),
    status,
    created_at: iso(createdDays),
    login_count: loginCount,
  });

  const healthy: DataRecord[] = [
    rec("C001", "Alice Meyer", "alice.meyer@example.com", "010-1000-0001", 2, "active", 400, 132),
    rec("C002", "Brian Cole", "brian.cole@example.com", "010-1000-0002", 5, "active", 390, 98),
    rec("C003", "Carmen Ruiz", "carmen.ruiz@example.com", "010-1000-0003", 1, "active", 380, 210),
    rec("C004", "David Kim", "david.kim@example.com", "010-1000-0004", 12, "active", 370, 76),
    rec("C005", "Emma Novak", "emma.novak@example.com", "010-1000-0005", 3, "active", 360, 154),
    rec("C006", "Frank Ortiz", "frank.ortiz@example.com", "010-1000-0006", 20, "active", 350, 61),
    rec("C007", "Grace Liu", "grace.liu@example.com", "010-1000-0007", 7, "active", 340, 187),
    rec("C008", "Henry Ford", "henry.ford@example.com", "010-1000-0008", 15, "active", 330, 88),
    rec("C009", "Irene Adler", "irene.adler@example.com", "010-1000-0009", 4, "active", 320, 143),
    rec("C010", "Jack Doyle", "jack.doyle@example.com", "010-1000-0010", 9, "active", 310, 112),
    rec("C011", "Karen Page", "karen.page@example.com", "010-1000-0011", 6, "active", 300, 95),
    rec("C012", "Leo Martins", "leo.martins@example.com", "010-1000-0012", 11, "active", 295, 129),
    rec("C013", "Mona Singh", "mona.singh@example.com", "010-1000-0013", 8, "active", 290, 167),
    rec("C014", "Nate Brooks", "nate.brooks@example.com", "010-1000-0014", 14, "active", 285, 73),
    rec("C015", "Olga Petrova", "olga.petrova@example.com", "010-1000-0015", 2, "active", 280, 201),
    rec("C016", "Paul Weber", "paul.weber@example.com", "010-1000-0016", 18, "active", 275, 58),
    rec("C017", "Quinn Adams", "quinn.adams@example.com", "010-1000-0017", 10, "active", 270, 104),
    rec("C018", "Rosa Diaz", "rosa.diaz@example.com", "010-1000-0018", 5, "active", 265, 176),
    rec("C019", "Sam Carter", "sam.carter@example.com", "010-1000-0019", 13, "active", 260, 84),
    rec("C020", "Tina Hoff", "tina.hoff@example.com", "010-1000-0020", 7, "active", 255, 149),
    rec("C021", "Umar Farouk", "umar.farouk@example.com", "010-1000-0021", 16, "active", 250, 67),
    rec("C022", "Vera Lindt", "vera.lindt@example.com", "010-1000-0022", 3, "active", 245, 193),
    rec("C023", "Will Turner", "will.turner@example.com", "010-1000-0023", 19, "active", 240, 52),
    rec("C024", "Xena Papas", "xena.papas@example.com", "010-1000-0024", 6, "active", 235, 118),
    rec("C025", "Yusuf Ali", "yusuf.ali@example.com", "010-1000-0025", 12, "active", 230, 91),
    rec("C026", "Zoe Laurent", "zoe.laurent@example.com", "010-1000-0026", 4, "active", 225, 158),
    rec("C027", "Omar Haddad", "omar.haddad@example.com", "010-1000-0027", 21, "active", 220, 47),
    rec("C028", "Lena Fischer", "lena.fischer@example.com", "010-1000-0028", 9, "active", 215, 136),
    // Boundary: 89 days inactive -> NOT a ghost (threshold is 90).
    rec("C029", "Peter Quill", "peter.quill@example.com", "010-1000-0029", 89, "inactive", 210, 23),
    // Boundary: 200 days away but still "active" -> NOT a ghost.
    rec("C030", "Sara Lindqvist", "sara.lindqvist@example.com", "010-1000-0030", 200, "active", 500, 12),
  ];

  const duplicates: DataRecord[] = [
    // Exact duplicates (same email): D01 is primary, D02/D03 merge into it.
    rec("D01", "Tom Becker", "tom.becker@example.com", "010-2000-0001", 6, "active", 420, 140),
    rec("D02", "Tom Becker", "Tom.Becker@Example.com", "010-2000-0002", 30, "active", 300, 41),
    rec("D03", "Tom Becker", "tom.becker@example.com", "010-2000-0003", 45, "inactive", 200, 9),
    // Fuzzy duplicates (name + email typo variants): D04 primary, D05/D06 merge.
    rec("D04", "John Smith", "john.smith@example.com", "010-2000-0004", 8, "active", 430, 121),
    rec("D05", "Jon Smith", "jon.smith@example.com", "010-2000-0005", 26, "active", 310, 37),
    rec("D06", "John Smyth", "john.smyth@example.com", "010-2000-0006", 52, "inactive", 190, 6),
  ];

  const ghosts: DataRecord[] = [
    // Boundary: exactly 91 days + inactive -> ghost.
    rec("G01", "Victor Crane", "victor.crane@example.com", "010-3000-0001", 91, "inactive", 600, 4),
    rec("G02", "Wendy Marsh", "wendy.marsh@example.com", "010-3000-0002", 140, "dormant", 700, 2),
    rec("G03", "Carl Jensen", "carl.jensen@example.com", "010-3000-0003", 230, "inactive", 800, 7),
    rec("G04", "Dana Whitfield", "dana.whitfield@example.com", "010-3000-0004", 365, "dormant", 900, 1),
    rec("G05", "Eli Navarro", "eli.navarro@example.com", "010-3000-0005", 540, "inactive", 1000, 3),
  ];

  const anomalies: DataRecord[] = [
    // Malformed email.
    rec("A01", "Faye Dunlop", "faye.dunlop@@example", "010-4000-0001", 10, "active", 300, 55),
    // Future last_login.
    rec("A02", "George Pappas", "george.pappas@example.com", "010-4000-0002", -5, "active", 300, 20),
    // Negative login_count.
    rec("A03", "Hana Sato", "hana.sato@example.com", "010-4000-0003", 15, "active", 300, -3),
    // Missing email.
    rec("A04", "Ivan Petrov", "", "010-4000-0004", 12, "active", 300, 44),
  ];

  return [...healthy, ...duplicates, ...ghosts, ...anomalies];
}

export function sampleCsv(now: Date = new Date()): string {
  return recordsToCsv(sampleRecords(now));
}
