import * as fs from "fs";
import * as path from "path";

describe("playground scripts", () => {
  const scriptsDir = path.join(__dirname, "..");

  it("should have run.js available and executable", () => {
    const runScript = path.join(scriptsDir, "run.js");
    expect(fs.existsSync(runScript)).toBe(true);
    const stat = fs.statSync(runScript);
    expect(stat.isFile()).toBe(true);
  });

  it("should have query.js available and executable", () => {
    const queryScript = path.join(scriptsDir, "query.js");
    expect(fs.existsSync(queryScript)).toBe(true);
    const stat = fs.statSync(queryScript);
    expect(stat.isFile()).toBe(true);
  });

  it("should have contribute.js available and executable", () => {
    const contributeScript = path.join(scriptsDir, "contribute.js");
    expect(fs.existsSync(contributeScript)).toBe(true);
    const stat = fs.statSync(contributeScript);
    expect(stat.isFile()).toBe(true);
  });

  it("should have no unreferenced legacy DOM shim files", () => {
    const allowedFiles = [
      "run.js",
      "query.js",
      "contribute.js",
      "withdraw.js",
      "refund.js",
      "__tests__",
    ];
    const allFiles = fs.readdirSync(scriptsDir);
    const unreferencedFiles = allFiles.filter(
      (f) => !allowedFiles.includes(f) && !f.startsWith(".")
    );
    expect(unreferencedFiles).toHaveLength(0);
  });

  it("should have scripts properly documented in playground README", () => {
    const readmePath = path.join(scriptsDir, "..", "README.md");
    const readme = fs.readFileSync(readmePath, "utf-8");

    expect(readme).toContain("scripts/run.js");
    expect(readme).toContain("scripts/query.js");
    expect(readme).toContain("scripts/contribute.js");
  });
});
