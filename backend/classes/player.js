class Player {
  constructor(name, id, score = 0) {
    this.name = name;
    this.id = id;
    this.score = score;
  }
}

module.exports = { Player };
