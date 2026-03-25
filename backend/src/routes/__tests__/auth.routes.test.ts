import request from "supertest";
import express from "express";
import authRoutes from "../auth.routes";
import * as emailUtils from "../../utils/email";
import * as tokenUtils from "../../utils/token";

// Mock otplib before importing auth routes
jest.mock("otplib", () => ({
  generateSecret: jest.fn(() => "mock-secret"),
  generateSync: jest.fn(() => "123456"),
  verifySync: jest.fn(() => ({ valid: true })),
  generateURI: jest.fn(() => "otpauth://totp/test"),
}));

jest.mock("qrcode", () => ({
  toDataURL: jest.fn(() => Promise.resolve("data:image/png;base64,mock")),
}));

// Mock dependencies
jest.mock("@prisma/client", () => {
  const mockPrisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
    __mockPrisma: mockPrisma,
  };
});

jest.mock("../../utils/email", () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock("../../utils/token", () => ({
  generateToken: jest.fn(() => "mock-raw-token"),
  hashToken: jest.fn((token: string) => `hashed-${token}`),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hashed-${password}`)),
  compare: jest.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed-${password}`),
  ),
}));

jest.mock("../../middleware/validation", () => ({
  validate: () => (req: any, res: any, next: any) => next(),
}));

jest.mock("../../middleware/auth", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.userId = "user123";
    next();
  }),
  AuthRequest: {},
}));

const { __mockPrisma: mockPrisma } = jest.requireMock("@prisma/client") as any;

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

describe("Auth Routes - Email Verification Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should create user and send verification email without issuing JWT", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "user123",
        walletAddress:
          "GTEST123ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJK",
        email: "test@example.com",
        username: "testuser",
        role: "FREELANCER",
        emailVerified: false,
        emailVerificationToken: "hashed-mock-raw-token",
      });

      const response = await request(app).post("/api/auth/register").send({
        stellarAddress:
          "GTEST123ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJK",
        email: "test@example.com",
        name: "testuser",
        password: "Password123",
        role: "FREELANCER",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty(
        "message",
        "Verification email sent. Please check your inbox.",
      );
      expect(response.body).not.toHaveProperty("token");
      expect(response.body).not.toHaveProperty("user");

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          emailVerificationToken: "hashed-mock-raw-token",
        }),
      });

      expect(emailUtils.sendVerificationEmail).toHaveBeenCalledWith(
        "test@example.com",
        "mock-raw-token",
      );
    });

    it("should return 409 if user already exists", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "existing",
        email: "test@example.com",
      });

      const response = await request(app).post("/api/auth/register").send({
        stellarAddress:
          "GTEST123ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJK",
        email: "test@example.com",
        name: "testuser",
        password: "Password123",
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty("error", "User already exists.");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should reject login if email is not verified", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
        password: "hashed-password123",
        emailVerified: false,
        isSuspended: false,
        twoFactorEnabled: false,
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error", "Email not verified.");
      expect(response.body).toHaveProperty(
        "message",
        "Please verify your email before logging in.",
      );
    });

    it("should allow login if email is verified", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
        password: "hashed-password123",
        emailVerified: true,
        isSuspended: false,
        twoFactorEnabled: false,
        walletAddress: "GTEST123",
        username: "testuser",
        role: "FREELANCER",
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id", "user123");
    });

    it("should return 401 for invalid credentials", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid credentials.");
    });
  });

  describe("GET /api/auth/verify-email/:token", () => {
    it("should verify email with valid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
        emailVerificationToken: "hashed-valid-token",
        emailVerified: false,
      });

      mockPrisma.user.update.mockResolvedValue({
        id: "user123",
        emailVerified: true,
        emailVerificationToken: null,
      });

      const response = await request(app).get(
        "/api/auth/verify-email/valid-token",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Email verified successfully.",
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
        },
      });
    });

    it("should return 400 for invalid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/auth/verify-email/invalid-token",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Invalid verification token.",
      );
    });
  });

  describe("POST /api/auth/resend-verification", () => {
    it("should resend verification email for unverified user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
        emailVerified: false,
      });

      mockPrisma.user.update.mockResolvedValue({
        id: "user123",
        emailVerificationToken: "hashed-mock-raw-token",
      });

      const response = await request(app)
        .post("/api/auth/resend-verification")
        .send({
          email: "test@example.com",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(emailUtils.sendVerificationEmail).toHaveBeenCalledWith(
        "test@example.com",
        "mock-raw-token",
      );
    });

    it("should not reveal if email exists (already verified)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
        emailVerified: true,
      });

      const response = await request(app)
        .post("/api/auth/resend-verification")
        .send({
          email: "test@example.com",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(emailUtils.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it("should not reveal if email does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/auth/resend-verification")
        .send({
          email: "nonexistent@example.com",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(emailUtils.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/send-verification (authenticated)", () => {
    it("should send verification email for authenticated unverified user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
        emailVerified: false,
      });

      mockPrisma.user.update.mockResolvedValue({
        id: "user123",
        emailVerificationToken: "hashed-mock-raw-token",
      });

      const response = await request(app).post("/api/auth/send-verification");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Verification email sent.",
      );
      expect(emailUtils.sendVerificationEmail).toHaveBeenCalled();
    });

    it("should return 400 if email already verified", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
        emailVerified: true,
      });

      const response = await request(app).post("/api/auth/send-verification");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Email is already verified.",
      );
    });
  });
});
