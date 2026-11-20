const Joi = require('joi');
const listingCategories=require("./utils/listingCategories.js");

module.exports.listingSchema= Joi.object({
    listing : Joi.object({
        title:Joi.string().required(),
        description:Joi.string().required(),
        location:Joi.string().required(),
        country:Joi.string().required(),
        category:Joi.string().valid(...listingCategories.map((category)=>category.name)).required(),
        price:Joi.number().required().min(0),
        image: Joi.string().allow("",null),
    }).required()
});

module.exports.reviewSchema=Joi.object({
    review: Joi.object({
        comment:Joi.string().required(),
        rating:Joi.number().required().min(1).max(5)
    }).required()

});

module.exports.userSchema=Joi.object({
    user: Joi.object({
        email: Joi.string().trim().email().required(),
        username: Joi.string().trim().required(),
        password:Joi.string().required()
    }).required()
});