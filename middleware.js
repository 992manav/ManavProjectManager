module.exports.isLoggedIn=(req,res,next)=>{
    // console.log(req.originalUrl);
    if(!req.isAuthenticated())
        {
            req.session.redirectUrl=req.originalUrl;
            req.flash("error","You must be logged in");
            res.redirect("/login");
        }else{
            next();
        }
       
};


module.exports.saveRedirectUrl=(req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl=req.session.redirectUrl;
    }
    next();
};