class Song {
  constructor(name, ytId, min, s) {
    this.name = name;
    this.ytId = ytId;
    this.min = min;
    this.s = s;
    this.length = min * 60 + s;
  }

  getRandomTime(minListenTime) {
    return Math.max(Math.random() * (this.length - minListenTime), 0);
  }
}

module.exports = { Song };
