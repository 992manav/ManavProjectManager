const mongoose=require("mongoose");
const PROJECT=require("./project.js");
const passportLocalMongoose=require("passport-local-mongoose");

const userSchema= new mongoose.Schema({
    usertype:{
        type:String,
        required:false,
    },
    name:{
        type:String,
        required:false,
    },
    email:{
        type:String,
        unique:true,
        required:true,
    },
   
});

userSchema.plugin(passportLocalMongoose,{ usernameField: 'email' });

userSchema.post("findOneAndDelete",async(user)=>{
    await PROJECT.deleteMany({ owner: user._id });
});

const USER=mongoose.model("USER",userSchema);
module.exports=USER;