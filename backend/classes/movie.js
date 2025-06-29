class Movie {
  constructor(name, songs) {
    this.name = name;

    this.sortingName = this.name.replace(/^(The|A|An) /g, "");

    this.songs = songs;
    for (let i = 0; i < songs.length; i++) {
      this.songs[i].movie = name;
    }

    this.imageId = name;
    this.imageId = this.imageId.toLowerCase();
    this.imageId = this.imageId.replace(/ /g, "-");
    this.imageId = this.imageId.replace(/[\,\.\;\?\!\'\"\(\)\[\]]/g, "");
  }
}

module.exports = { Movie };
