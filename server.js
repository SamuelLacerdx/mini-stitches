require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// alterar Modelo e modeloSchema 

const modeloSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  sobrenome: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true },
  senhaHash: { type: String, required: true, select: false },
});

const MOdelo = mongoose.model("MOdelo", modeloSchema);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function iniciar() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado!");

    await MOdelo.init();

    app.listen(4000, () => {
      console.log("Abra http://localhost:4000");
    });
  } catch (erro) {
    console.error("Erro na conexão:", erro.message);
  }
}

iniciar();