import { describe, it, expect, beforeEach } from "vitest";

const ERR_INVALID_IDENTITY = 1000;
const ERR_DUPLICATE_REGISTRATION = 1001;
const ERR_INVALID_JURISDICTION = 1002;
const ERR_NOT_ADMIN = 1003;
const ERR_REGISTRATION_NOT_FOUND = 1004;
const ERR_INVALID_HASH = 1005;
const ERR_INVALID_TITLE = 1006;
const ERR_INVALID_DESCRIPTION = 1007;
const ERR_INVALID_STATUS = 1008;
const ERR_INVALID_ELIGIBILITY_SCORE = 1009;
const ERR_INVALID_USER_PRINCIPAL = 1010;
const ERR_INVALID_TIMESTAMP = 1011;
const ERR_INVALID_USER_ID = 1012;
const ERR_AUTHORITY_NOT_VERIFIED = 1013;
const ERR_MAX_REGISTRATIONS_EXCEEDED = 1016;

interface Registration {
  registrationHash: string;
  title: string;
  description: string;
  timestamp: number;
  status: string;
  eligibilityScore: number;
}

interface RegistrationUpdate {
  updateTitle: string;
  updateDescription: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class RegistrationContractMock {
  state: {
    nextRegistrationId: number;
    maxRegistrations: number;
    registrationFee: number;
    authorityContract: string | null;
    registrations: Map<string, Registration>;
    registrationUpdates: Map<string, RegistrationUpdate>;
    jurisdictionRegCounts: Map<string, number>;
  } = {
    nextRegistrationId: 0,
    maxRegistrations: 1000000,
    registrationFee: 100,
    authorityContract: null,
    registrations: new Map(),
    registrationUpdates: new Map(),
    jurisdictionRegCounts: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  mockIdentity: Map<string, string> = new Map([["ST1TEST", "userhash123"]]);
  mockJurisdictions: Set<string> = new Set(["USA", "EU"]);
  mockRules: Map<string, { minAge: number; minResidency: number }> = new Map([["USA", { minAge: 18, minResidency: 1 }]]);
  mockEligibilityScores: Map<string, number> = new Map();
  mockAdmins: Set<string> = new Set(["ST1TEST"]);

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextRegistrationId: 0,
      maxRegistrations: 1000000,
      registrationFee: 100,
      authorityContract: null,
      registrations: new Map(),
      registrationUpdates: new Map(),
      jurisdictionRegCounts: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.mockIdentity = new Map([["ST1TEST", "userhash123"]]);
    this.mockJurisdictions = new Set(["USA", "EU"]);
    this.mockRules = new Map([["USA", { minAge: 18, minResidency: 1 }]]);
    this.mockEligibilityScores = new Map();
    this.mockAdmins = new Set(["ST1TEST"]);
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === this.caller) return { ok: false, value: ERR_INVALID_USER_PRINCIPAL };
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxRegistrations(newMax: number): Result<boolean> {
    if (newMax <= 0) return { ok: false, value: ERR_MAX_REGISTRATIONS_EXCEEDED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.maxRegistrations = newMax;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (newFee < 0) return { ok: false, value: ERR_INVALID_HASH };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  registerVoter(
    userPrincipal: string,
    userId: string,
    jurisdictionId: string,
    registrationHash: string,
    title: string,
    description: string
  ): Result<Registration> {
    if (this.state.nextRegistrationId >= this.state.maxRegistrations) return { ok: false, value: ERR_MAX_REGISTRATIONS_EXCEEDED };
    if (userId.length === 0 || userId.length > 40) return { ok: false, value: ERR_INVALID_USER_ID };
    if (registrationHash.length === 0 || registrationHash.length > 64) return { ok: false, value: ERR_INVALID_HASH };
    if (title.length === 0 || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    const identityHash = this.mockIdentity.get(userPrincipal);
    if (!identityHash || identityHash !== userId) return { ok: false, value: ERR_INVALID_IDENTITY };
    if (!this.mockJurisdictions.has(jurisdictionId)) return { ok: false, value: ERR_INVALID_JURISDICTION };
    const key = `${userId}-${jurisdictionId}`;
    if (this.state.registrations.has(key)) return { ok: false, value: ERR_DUPLICATE_REGISTRATION };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });
    const rules = this.mockRules.get(jurisdictionId);
    const scoreKey = `${jurisdictionId}-${registrationHash}`;
    const score = this.mockEligibilityScores.get(scoreKey) || 100;
    const newReg: Registration = {
      registrationHash,
      title,
      description,
      timestamp: this.blockHeight,
      status: "active",
      eligibilityScore: score,
    };
    this.state.registrations.set(key, newReg);
    const count = (this.state.jurisdictionRegCounts.get(jurisdictionId) || 0) + 1;
    this.state.jurisdictionRegCounts.set(jurisdictionId, count);
    this.state.nextRegistrationId++;
    return { ok: true, value: newReg };
  }

  getRegistration(userId: string, jurisdictionId: string): Registration | null {
    const key = `${userId}-${jurisdictionId}`;
    return this.state.registrations.get(key) || null;
  }

  updateRegistration(userId: string, jurisdictionId: string, updateTitle: string, updateDescription: string): Result<boolean> {
    const key = `${userId}-${jurisdictionId}`;
    const reg = this.state.registrations.get(key);
    if (!reg) return { ok: false, value: ERR_REGISTRATION_NOT_FOUND };
    if (!this.mockAdmins.has(this.caller)) return { ok: false, value: ERR_NOT_ADMIN };
    if (updateTitle.length === 0 || updateTitle.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (updateDescription.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    const updated: Registration = { ...reg, title: updateTitle, description: updateDescription, timestamp: this.blockHeight };
    this.state.registrations.set(key, updated);
    this.state.registrationUpdates.set(key, {
      updateTitle,
      updateDescription,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  updateRegistrationStatus(userId: string, jurisdictionId: string, newStatus: string): Result<boolean> {
    const key = `${userId}-${jurisdictionId}`;
    const reg = this.state.registrations.get(key);
    if (!reg) return { ok: false, value: ERR_REGISTRATION_NOT_FOUND };
    if (!this.mockAdmins.has(this.caller)) return { ok: false, value: ERR_NOT_ADMIN };
    if (!["active", "archived", "pending"].includes(newStatus)) return { ok: false, value: ERR_INVALID_STATUS };
    const updated: Registration = { ...reg, status: newStatus, timestamp: this.blockHeight };
    this.state.registrations.set(key, updated);
    return { ok: true, value: true };
  }

  getRegistrationCount(): Result<number> {
    return { ok: true, value: this.state.nextRegistrationId };
  }

  getJurisdictionRegCount(jurisdictionId: string): number {
    return this.state.jurisdictionRegCounts.get(jurisdictionId) || 0;
  }
}

describe("RegistrationContract", () => {
  let contract: RegistrationContractMock;

  beforeEach(() => {
    contract = new RegistrationContractMock();
    contract.reset();
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    contract.caller = "ST3FAKE";
    const result = contract.setAuthorityContract("ST3FAKE");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_USER_PRINCIPAL);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(200);
    expect(result.ok).toBe(true);
    expect(contract.state.registrationFee).toBe(200);
  });

  it("rejects registration fee change without authority", () => {
    const result = contract.setRegistrationFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("registers voter successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Voter Reg",
      "Description"
    );
    expect(result.ok).toBe(true);
    const reg = result.value;
    expect(reg.registrationHash).toBe("regHash123");
    expect(reg.title).toBe("Voter Reg");
    expect(reg.description).toBe("Description");
    expect(reg.status).toBe("active");
    expect(reg.eligibilityScore).toBe(100);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
    expect(contract.getJurisdictionRegCount("USA")).toBe(1);
  });

  it("rejects duplicate registration", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Voter Reg",
      "Description"
    );
    const result = contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash456",
      "New Reg",
      "New Desc"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DUPLICATE_REGISTRATION);
  });

  it("rejects invalid jurisdiction", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "INVALID",
      "regHash123",
      "Voter Reg",
      "Description"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_JURISDICTION);
  });

  it("rejects without authority contract", () => {
    const result = contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Voter Reg",
      "Description"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid title", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "",
      "Description"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("updates registration successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Old Title",
      "Old Desc"
    );
    const result = contract.updateRegistration("userhash123", "USA", "New Title", "New Desc");
    expect(result.ok).toBe(true);
    const reg = contract.getRegistration("userhash123", "USA");
    expect(reg?.title).toBe("New Title");
    expect(reg?.description).toBe("New Desc");
    const update = contract.state.registrationUpdates.get("userhash123-USA");
    expect(update?.updateTitle).toBe("New Title");
    expect(update?.updateDescription).toBe("New Desc");
  });

  it("rejects update by non-admin", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Title",
      "Desc"
    );
    contract.mockAdmins.clear();
    const result = contract.updateRegistration("userhash123", "USA", "New Title", "New Desc");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_ADMIN);
  });

  it("updates status successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Title",
      "Desc"
    );
    const result = contract.updateRegistrationStatus("userhash123", "USA", "archived");
    expect(result.ok).toBe(true);
    const reg = contract.getRegistration("userhash123", "USA");
    expect(reg?.status).toBe("archived");
  });

  it("rejects invalid status", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Title",
      "Desc"
    );
    const result = contract.updateRegistrationStatus("userhash123", "USA", "invalid");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STATUS);
  });

  it("rejects max registrations exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxRegistrations = 1;
    contract.registerVoter(
      "ST1TEST",
      "userhash123",
      "USA",
      "regHash123",
      "Title",
      "Desc"
    );
    const result = contract.registerVoter(
      "ST1TEST",
      "userhash456",
      "EU",
      "regHash456",
      "Title2",
      "Desc2"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_REGISTRATIONS_EXCEEDED);
  });
});