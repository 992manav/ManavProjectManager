const express =require("express");
const app=express();
const mongoose=require("mongoose");
const path=require("path");
const methodOverride=require("method-override");
const ejsMate=require("ejs-mate");
const ExpressError=require("./utils/ExpressError.js");
const wrapAsync=require("./utils/WrapAsync.js");
const session=require("express-session");
const MongoStore = require('connect-mongo');
const flash=require("connect-flash");
const {isLoggedIn}=require("./middleware.js");
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const passport=require("passport");
const localStrategy=require("passport-local");

const USER=require("./models/user.js");
const PROJECT=require("./models/project.js");
const { error } = require("console");
const {saveRedirectUrl }=require("./middleware.js");

if(process.env.NODE_ENV !='production'){
    require('dotenv').config()
}

const multer  = require('multer');

const {storage}=require("./cloudConfig.js");
const upload = multer({ storage });

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"/views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname,"/public")));

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.GMAIL_USERNAME,
        pass: process.env.GMAIL_PASS
    }
});

let tokens = {}; 

const dbUrl=process.env.ATLASDB_URL;

const store=MongoStore.create({ 
    mongoUrl: dbUrl,
    crypto:{
        secret:process.env.SECRET
    },
    touchAfter:24*3600,
});

store.on("error",()=>{
    console.log("ERROR  IN MONGO STORE",err);
});

const sessionOption={
    store,
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly:true,
    }
};



main()
    .then(()=>{
        console.log("connected to db");
    })
    .catch((err)=>{
        console.log(err);
    })


async function main() {
    await mongoose.connect(dbUrl); 
}


app.listen(8080,()=>{
    console.log("server is listening");
});


app.use(session(sessionOption));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new localStrategy({ usernameField: 'email' },USER.authenticate()));

passport.serializeUser(USER.serializeUser());
passport.deserializeUser(USER.deserializeUser());

app.use((req,res,next)=>{
    res.locals.success = req.flash("success");
    // console.log(res.locals.success);
    res.locals.error=req.flash("error");
    res.locals.currUser=req.user;
    
    next();
});



    // app.get("/demoproject",async(req,res)=>{
    //     let fakeProject=new PROJECT({
    //         projectname: 'student',
    //         github_link: "John Doe",
    //         thumbnail:"student@gmail.com",
            
    //     });
    //     fakeProject.save();
    //     res.send(fakeProject);
    // });

function isValidEmail(email) {
    return email.endsWith('@lnmiit.ac.in');
};

function isValidPassword(password) {
    const minLength = 8;
    const uppercasePattern = /[A-Z]/;
    const lowercasePattern = /[a-z]/;
    const numberPattern = /[0-9]/;
    const specialCharPattern = /[!@#$%^&*(),.?":{}|<>]/;

    if (password.length < minLength) {
        return false;
    }
    if (!uppercasePattern.test(password)) {
        return false;
    }
    if (!lowercasePattern.test(password)) {
        return false;
    }
    if (!numberPattern.test(password)) {
        return false;
    }
    if (!specialCharPattern.test(password)) {
        return false;
    }
    return true;
}



app.post("/signup", wrapAsync(async(req,res)=>{
    try {
        let { usertype,name,email,password,confirmPassword}=req.body;
        // console.log(req.body);

        const adminEmails = [
            "22ucs216@lnmiit.ac.in",
            "22ucs067@lnmiit.ac.in",
            "22ucs110@lnmiit.ac.in",
            "22ucs236@lnmiit.ac.in",
            "22ucs212@lnmiit.ac.in",
            "23ucs639@lnmiit.ac.in"
        ];


        if (usertype === "admin" && !adminEmails.includes(email)) {
            throw new Error("You are not authorized to register as an admin.");
        }
        if (usertype === "student" && adminEmails.includes(email)) {
            throw new Error("Your Email has privilege to register as an admin Only , So Please select admin");
        }

        // console.log(usertype);
        // console.log(name);
        // console.log(email);
        // console.log(password);
        // console.log(confirmPassword);

            if(!isValidEmail(email))
            {
                throw new Error("Only institute emails ending with @lnmiit.ac.in are acceptable.");
            }
            if (!isValidPassword(password)) {
                throw new Error("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
            }   
            if(password!=confirmPassword)
            {
                throw new Error("Confirm password is not equal to password entered above");
            }
            
            const newUser=new USER({
                usertype:usertype,
                name:name,
                email:email,

            });

            let registeredUser=await USER.register(newUser,password);
               
            // console.log(registeredUser);


            const token = crypto.randomBytes(32).toString('hex');
            tokens[email] = { token, password, expires: Date.now() + 3600000 }; 
    
           
            const link = `${process.env.BASE_URL}/verify?email=${encodeURIComponent(email)}&token=${token}`;
            const mailOptions = {
                from: process.env.GMAIL_USERNAME,
                to: email,
                subject: 'Complete your registration',
                text: `Please click the following link to complete your registration: ${link}`
            };
    
            await transporter.sendMail(mailOptions);
    
            req.flash("success", "A confirmation email has been sent to your email address.");
            res.redirect("/signup");
    
        // else{
        //     req.flash("success","Confirm Password hogayaaaa");
        //     res.redirect("/login");
        // }
      
    } catch (err) {
        req.flash("error",err.message);
        res.redirect("/signup");
    }
        
}));

app.get("/verify", (req, res) => {
    const { email, token } = req.query;
    if (tokens[email] && tokens[email].token === token && tokens[email].expires > Date.now()) {
        const { password } = tokens[email];
        delete tokens[email]; 
        req.flash("success", "Your registration is complete. Please log in.");
        res.redirect("/login");
    } else {
        req.flash("error", "Invalid or expired token.");
        res.redirect("/signup");
    }
});


app.get("/signup",(req,res)=>{
    res.render("pages/signup.ejs");
});

app.get("/login",(req,res)=>{
    res.render("pages/login.ejs");
});

app.post("/login",saveRedirectUrl,passport.authenticate("local",{ failureRedirect:'/login',failureFlash:true}),(req,res)=>{
   try{
    let { email,password}=req.body;
    // console.log(req.body);
   
    // console.log(email);
    // console.log(password);
    if(!isValidEmail(email))
            {
                throw new Error("Only institute emails ending with @lnmiit.ac.in are acceptable.");
            }
    if (!isValidPassword(password)) {
        throw new Error("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
    }  
    req.flash("success","User Logged in Successfully");
   // res.render("pages/dashboard.ejs");
   let redirectUrl=res.locals.redirectUrl || "/dashboard";
    res.redirect(redirectUrl);
   }catch(err){
    req.flash("error",err.message);
    res.redirect("/login");
   }
   
});

app.get("/dashboard/new",isLoggedIn,(req,res)=>{
    res.render("pages/newproject.ejs");
});


app.post("/dashboard/new",upload.single('thumbnail'),(req,res)=>{
    let url=req.file.path;
    let filename=req.file.filename;
    // console.log(url);
    // console.log(filename);
    let {projectname,github_link,live_link,tech_stack}=req.body;

    let newProject=new PROJECT({projectname,github_link,live_link,tech_stack,owner:req.user._id});
    newProject.thumbnail={url,filename};
            newProject.save();
           // res.send(newProject);
    res.redirect("/dashboard");

   
});



app.get("/dashboard",wrapAsync(async (req,res)=>{
    //console.log(currUser);
    // console.log(req.user);
    if(typeof req.user!=="undefined")
    {
            if(req.user.usertype==='student')
            {
                let id=req.user._id;
                const projects=await PROJECT.find({owner:id}).populate("owner");
                res.render("pages/dashboard.ejs",{projects});
            }
            else{
                const projects=await PROJECT.find({}).populate("owner");
                res.render("pages/dashboard.ejs",{projects});
            }
    }
    else{
        res.render("pages/home.ejs");
    }

}));

app.delete("/dashboard/admin/user/:id",isLoggedIn,wrapAsync(async (req,res)=>{
    let {id}=req.params;

    if(req.user.usertype==='student'){
        req.flash("error"," You don't have permission to DELETE");
        return res.redirect(`/dashboard/${id}`);
    }

    const removeUser=await USER.findByIdAndDelete(`${id}`);
    // console.log(removeUser);
    req.flash("success","User Deleted");
    res.redirect('/dashboard');
}));


app.get("/dashboard/:id",isLoggedIn,wrapAsync(async (req,res)=>{
    let {id}=req.params;
    const project=await PROJECT.findById(`${id}`).populate("owner");
    if((!project.owner._id.equals(res.locals.currUser._id))&&(req.user.usertype==='student')){
        req.flash("error"," You don't have permission to edit");
       return res.redirect(`/dashboard/${id}`);
    }

    // console.log(project);
    if(!project){
        req.flash("error","Project Details you requested does not exist!");
       return res.redirect("/dashboard");
    }
    res.render("pages/show.ejs",{project});
}));


app.get("/dashboard/:id/edit",isLoggedIn,wrapAsync(async (req,res)=>{
    let {id}=req.params;
    const project=await PROJECT.findById(`${id}`);
   
    if(!project){
        req.flash("error","Project you requested does not exist!");
        res.redirect("/dashboard");
    }
    res.render("pages/edit.ejs",{project});
}));

app.put("/dashboard/:id/edit",isLoggedIn,upload.single('thumbnail'),wrapAsync(async (req,res)=>{
    let {id}=req.params;
    // console.log(req.body);
    

    const project=await PROJECT.findById(`${id}`);
    if((!project.owner._id.equals(res.locals.currUser._id))&&(req.user.usertype==='student')){
        req.flash("error"," You don't have permission to edit");
       return res.redirect(`/dashboard/${id}`);
    }

    let updateProject=await PROJECT.findByIdAndUpdate(`${id}`,req.body);

    if(typeof req.file!=="undefined"){
        let url=req.file.path;
        let filename=req.file.filename;
    
        // console.log(url);
        // console.log(filename);
        updateProject.thumbnail={url,filename};
        await updateProject.save();
    }
   
    req.flash("success"," Project Details Updated");
    res.redirect(`/dashboard/${id}`);
}));

app.delete("/dashboard/:id",isLoggedIn,wrapAsync(async (req,res)=>{
    let {id}=req.params;

    const project=await PROJECT.findById(`${id}`);
    if((!project.owner._id.equals(res.locals.currUser._id))&&(req.user.usertype==='student')){
        req.flash("error"," You don't have permission to DELETE");
        return res.redirect(`/dashboard/${id}`);
    }

    let delproject=await PROJECT.findByIdAndDelete(`${id}`);
    // console.log(delproject);
    req.flash("success","Project Deleted");
    res.redirect('/dashboard');
}));


app.get("/logout",(req,res,next)=>{
        req.logout((err)=>{
            if(err){
                return next(err);
            }
            else{
                req.flash("success","Logged-Out Successfully");
                res.redirect('/dashboard');
            }
})
});

app.all("*",(req,res,next)=>{
    next(new ExpressError(404,"Page nahi mila"));
});



app.use((err,req,res,next)=>{
    let {statusCode=500,message='Kuchh Galat Hogayaaa....'}=err;
    // console.log(statusCode,message);
     res.status(statusCode);
   res.render("error.ejs",{err});
});



