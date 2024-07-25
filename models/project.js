const USER=require("./user.js");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const projectSchema = new Schema({
    projectname: {
        type: String,
        required: true,
    },
    github_link: {
        type: String,
        required: true,
    },
    thumbnail: { 
        url:String,
        filename:String,
    },
    live_link: {
        type: String,
        required: false,
    },
    tech_stack: {
        type: String,
        required: false,
    },
    owner:{
        type:Schema.Types.ObjectId,
        ref:"USER",
    }
});


const PROJECT = mongoose.model("PROJECT", projectSchema);

module.exports = PROJECT;
