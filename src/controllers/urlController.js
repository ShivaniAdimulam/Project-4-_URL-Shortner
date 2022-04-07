const express = require('express')
const validUrl = require('valid-url')
const shortid = require('shortid')
const urlModel = require('../models/urlModel')

const router = express.Router()

const redis = require("redis");
const { promisify } = require("util")

const redisClient = redis.createClient(
    16250,
    "redis-16250.c264.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("F4w4627uqviBHIHrSIo7N7gTKmlgFhx1", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

const isValidRequestBody = function (requestBody) {
    return Object.keys(requestBody).length > 0
}

const isValid = function (value) {
    if (typeof value === "undefined" || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false
    return true;
}

const baseUrl = 'http://localhost:3000'

const createUrl = async function (req, res) {
    try {
        if (!isValidRequestBody(req.body)) {
            res.status(400).send({ status: false, message: 'Invalid request parameters. Please provide URL details' })
            return
        }

        // if (!isValid(urlCode)) {
        //     res.status(400).send({ status: false, messege: "Please provide The urlCode" });
        //     return
        // }
        // if (!isValid(shortUrl)) {
        //     res.status(400).send({ status: false, messege: "Please provide The urlCode" });
        //     return
        // }

        const { longUrl } = req.body

        if (!isValid(longUrl)) {
            res.status(400).send({ status: false, messege: "Please provide The longUrl" });
            return
        }

        if (!validUrl.isUri(baseUrl)) {
            return res.status(401).send({status:false,msg:'Invalid base url'})
        }

        if (!validUrl.isUri(longUrl)) {
            return res.status(401).send({status:false,msg:'Invalid long url'})
        }

        let urlCode = shortid.generate().match(/[a-z\A-Z]/g).join("") //---this will give only Alphabet
        urlCode = urlCode.toLowerCase()     //now urlcode is->lowercase only no->no.'s ,or char, or uppercase

        //FETCH THE DATA FROM CACHE IN REDIS
        let checkforUrl = await GET_ASYNC(`${longUrl}`)
        if (checkforUrl) {
            return res.status(200).send({ status: true,msg: "short url for given long url is already exist", "data": JSON.parse(checkforUrl) })
        }

        if (validUrl.isUri(longUrl)) {
            let url = await urlModel.findOne({ longUrl })
            if (url) {
                return res.status(200).send({ status:true,msg: "short url for given long url is already exist in db", data: url })
            } else {
                const shortUrl = baseUrl + "/" + urlCode

                // url= new urlModel({
                //     longUrl,
                //     shortUrl,
                //     urlCode
                // })
                // await url.save()
                // res.json(url)
                const urlData = {
                    longUrl,
                    shortUrl,
                    urlCode
                }
                const newurl = await urlModel.create(urlData);
                //SET GENERATED DATA IN CACHE
                await SET_ASYNC(`${longUrl}`, JSON.stringify(urlData))
                return res.status(201).send({ status: true, msg: `URL created successfully`, data: newurl });
            }
        }

    } catch (err) {
        return res.status(500).send({ status: false, msg: err.message })

    }
}


const getUrl = async function (req, res) {
    try {

        const urlCode = req.params.urlCode          //.trim().toLowerCase()
        if (!isValid(urlCode)) {
            res.status(400).send({ status: false, messege: "Please provide The urlCode" });
            return
        }

        let checkforUrl = await GET_ASYNC(`${urlCode}`)    //first check in cache
        if (checkforUrl) {
            return res.redirect(302, JSON.parse(checkforUrl))
        }


        const url = await urlModel.findOne({
            urlCode: urlCode
        })
        if (url) {
            // when valid we perform a redirect
            await SET_ASYNC(`${urlCode}`, JSON.stringify(url.longUrl))     //if data found in db than created in cache
            return res.redirect(url.longUrl)
            // return res.status(200).send({ status: true, Data: url })
        } else {
            // else return a not found 404 status
            return res.status(404).send({status:false,msg:'No URL Found'})
        }

    } catch (err) {

        return res.status(500).send({status:false,msg:err.message})

    }
}

module.exports.createUrl = createUrl
module.exports.getUrl = getUrl