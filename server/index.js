import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(3000, "0.0.0.0", () => {
  console.log("Backend running at http://localhost:3000");
});
