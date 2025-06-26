const { Connection } = require("./structures/Connection");
const { Filters } = require("./structures/Filters");
const { Node } = require("./structures/Node");
const { Euralink } = require("./structures/Euralink");
const { Player } = require("./structures/Player");
const { Plugin } = require("./structures/Plugin");
const { Queue } = require("./structures/Queue");
const { Rest } = require("./structures/Rest");
const { Track } = require("./structures/Track");
const { EuraSync } = require("./structures/EuraSync");

module.exports = {
    Euralink,
    Node,
    Player,
    Plugin,
    Track,
    Queue,
    Filters,
    Connection,
    Rest,
    EuraSync
};