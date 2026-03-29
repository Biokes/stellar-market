import request from "supertest";
import express from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import jobRoutes from "../job.routes";
import { config } from "../../config";

const app = express();
app.use(express.json());
app.use("/api/jobs", jobRoutes);

const prisma = new PrismaClient();

describe("Saved Jobs API", () => {
  let freelancerToken: string;
  let clientToken: string;
  let freelancerId: string;
  let clientId: string;
  let jobId: string;

  beforeAll(async () => {
    // Create test users
    const freelancer = await prisma.user.create({
      data: {
        walletAddress: `test-freelancer-${Date.now()}`,
        username: `freelancer-${Date.now()}`,
        email: `freelancer-${Date.now()}@test.com`,
        role: "FREELANCER",
      },
    });
    freelancerId = freelancer.id;
    freelancerToken = jwt.sign({ userId: freelancerId }, config.jwtSecret);

    const client = await prisma.user.create({
      data: {
        walletAddress: `test-client-${Date.now()}`,
        username: `client-${Date.now()}`,
        email: `client-${Date.now()}@test.com`,
        role: "CLIENT",
      },
    });
    clientId = client.id;
    clientToken = jwt.sign({ userId: clientId }, config.jwtSecret);

    // Create a test job
    const job = await prisma.job.create({
      data: {
        title: "Test Job for Bookmarking",
        description: "This is a test job for the bookmarking feature",
        budget: 1000,
        category: "Development",
        skills: ["JavaScript", "Node.js"],
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        clientId,
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.savedJob.deleteMany({
      where: { freelancerId },
    });
    await prisma.job.deleteMany({
      where: { clientId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [freelancerId, clientId] } },
    });
    await prisma.$disconnect();
  });

  describe("POST /api/jobs/:id/save", () => {
    it("should allow freelancer to save a job", async () => {
      const response = await request(app)
        .post(`/api/jobs/${jobId}/save`)
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(201);

      expect(response.body.message).toBe("Job saved successfully.");
      expect(response.body.savedJob).toHaveProperty("id");
      expect(response.body.savedJob.freelancerId).toBe(freelancerId);
      expect(response.body.savedJob.jobId).toBe(jobId);
    });

    it("should return 409 when trying to save an already saved job", async () => {
      const response = await request(app)
        .post(`/api/jobs/${jobId}/save`)
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(409);

      expect(response.body.error).toBe("Job already saved.");
    });

    it("should return 404 when trying to save a non-existent job", async () => {
      const response = await request(app)
        .post("/api/jobs/non-existent-id/save")
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(404);

      expect(response.body.error).toBe("Job not found.");
    });

    it("should return 403 when client tries to save a job", async () => {
      const response = await request(app)
        .post(`/api/jobs/${jobId}/save`)
        .set("Authorization", `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.error).toBe("Only freelancers can save jobs.");
    });

    it("should return 401 when unauthenticated user tries to save a job", async () => {
      await request(app)
        .post(`/api/jobs/${jobId}/save`)
        .expect(401);
    });
  });

  describe("GET /api/jobs/saved", () => {
    it("should return saved jobs for authenticated freelancer", async () => {
      const response = await request(app)
        .get("/api/jobs/saved")
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("totalPages");
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("isSaved", true);
      expect(response.body.data[0]).toHaveProperty("savedAt");
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/jobs/saved?page=1&limit=5")
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it("should support search filter", async () => {
      const response = await request(app)
        .get("/api/jobs/saved?search=Bookmarking")
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].title).toContain("Bookmarking");
    });

    it("should support skill filter", async () => {
      const response = await request(app)
        .get("/api/jobs/saved?skill=JavaScript")
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].skills).toContain("JavaScript");
    });

    it("should return 403 when client tries to view saved jobs", async () => {
      const response = await request(app)
        .get("/api/jobs/saved")
        .set("Authorization", `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.error).toBe("Only freelancers can view saved jobs.");
    });

    it("should return 401 when unauthenticated user tries to view saved jobs", async () => {
      await request(app)
        .get("/api/jobs/saved")
        .expect(401);
    });
  });

  describe("DELETE /api/jobs/:id/save", () => {
    it("should allow freelancer to unsave a job", async () => {
      const response = await request(app)
        .delete(`/api/jobs/${jobId}/save`)
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(200);

      expect(response.body.message).toBe("Job unsaved successfully.");

      // Verify it's actually removed
      const savedJob = await prisma.savedJob.findUnique({
        where: {
          freelancerId_jobId: {
            freelancerId,
            jobId,
          },
        },
      });
      expect(savedJob).toBeNull();
    });

    it("should return 404 when trying to unsave a job that was not saved", async () => {
      const response = await request(app)
        .delete(`/api/jobs/${jobId}/save`)
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(404);

      expect(response.body.error).toBe("Job was not saved.");
    });

    it("should return 403 when client tries to unsave a job", async () => {
      const response = await request(app)
        .delete(`/api/jobs/${jobId}/save`)
        .set("Authorization", `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.error).toBe("Only freelancers can unsave jobs.");
    });

    it("should return 401 when unauthenticated user tries to unsave a job", async () => {
      await request(app)
        .delete(`/api/jobs/${jobId}/save`)
        .expect(401);
    });
  });

  describe("GET /api/jobs/:id - isSaved field", () => {
    beforeAll(async () => {
      // Save the job again for this test
      await prisma.savedJob.create({
        data: {
          freelancerId,
          jobId,
        },
      });
    });

    it("should include isSaved: true when freelancer has saved the job", async () => {
      const response = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("isSaved", true);
    });

    it("should include isSaved: false when freelancer has not saved the job", async () => {
      // Create another job
      const anotherJob = await prisma.job.create({
        data: {
          title: "Another Test Job",
          description: "This job is not saved",
          budget: 500,
          category: "Design",
          skills: ["Figma"],
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          clientId,
        },
      });

      const response = await request(app)
        .get(`/api/jobs/${anotherJob.id}`)
        .set("Authorization", `Bearer ${freelancerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("isSaved", false);

      // Clean up
      await prisma.job.delete({ where: { id: anotherJob.id } });
    });

    it("should include isSaved: false when client views a job", async () => {
      const response = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set("Authorization", `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("isSaved", false);
    });

    it("should include isSaved: false when unauthenticated user views a job", async () => {
      const response = await request(app)
        .get(`/api/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty("isSaved", false);
    });
  });

  describe("Cascade delete", () => {
    it("should delete saved jobs when the job is deleted", async () => {
      // Create a new job
      const tempJob = await prisma.job.create({
        data: {
          title: "Temporary Job",
          description: "This job will be deleted",
          budget: 750,
          category: "Testing",
          skills: ["QA"],
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          clientId,
        },
      });

      // Save the job
      await prisma.savedJob.create({
        data: {
          freelancerId,
          jobId: tempJob.id,
        },
      });

      // Verify it's saved
      let savedJob = await prisma.savedJob.findUnique({
        where: {
          freelancerId_jobId: {
            freelancerId,
            jobId: tempJob.id,
          },
        },
      });
      expect(savedJob).not.toBeNull();

      // Delete the job
      await prisma.job.delete({ where: { id: tempJob.id } });

      // Verify the saved job is also deleted
      savedJob = await prisma.savedJob.findUnique({
        where: {
          freelancerId_jobId: {
            freelancerId,
            jobId: tempJob.id,
          },
        },
      });
      expect(savedJob).toBeNull();
    });
  });
});
