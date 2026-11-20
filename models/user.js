const mongoose=require("mongoose");
const {Schema,model}=mongoose;
const passportLocalMongoose=require("passport-local-mongoose");

const userSchema= new Schema({
    email:{
        type:String,
        required: true
    },
    favorites:[
        {
            type:Schema.Types.ObjectId,
            ref:"Listing"
        }
    ]
});

userSchema.plugin(passportLocalMongoose);

module.exports=model("User",userSchema);