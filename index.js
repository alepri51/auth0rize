const axios = require('axios');
const jsonwebtoken = require('jsonwebtoken');

const express = require('express');

class Auth0rize {
    constructor({ url, key, secret }) {
        this.axios = axios.create({
            baseURL: url
        });

        this.key = key;
        this.secret = secret;
    }

    bots() {
        return async (req, res, next) => {
            let { data: { content } } = await this.axios({
                url: '/service/bots',
                method: 'POST',
                data: {
                    owner: this.key
                }
            });
        
            res.json(content);
        }
    }

    link() {
        return async (req, res, next) => {
            let { bot_id, platform = 'web', meta = {} } = req.body;
        
            let data = {
                key: this.key,
                bot_id,
                platform,
                meta
            }
        
            let jwt = jsonwebtoken.sign(data, this.secret);
        
            let { data: { content } } = await this.axios({
                url: '/service/links',
                method: 'GET',
                params: { jwt }
            });

            res.json(content);
        }
    }

    auth(callback) {
        return async (req, res, next) => {
            let { jwt } = req.body;
        
            let payload = {};

            try {
                payload = jsonwebtoken.verify(jwt, this.secret);
            }
            catch(error) {
                payload.error = error;
            }
        
            let { user, meta, token, error } = payload;

            let message = void 0;

            if(error) {
                message = callback(req, res, next, error);
            }
            else {
                let data = { token, user, meta };

                message = callback(req, res, next, void 0, data);
            }

            message = message || 'HI';

            res.json({ message });
        }
    }
}

const auth0rize = ({ url, key, secret, onAuth, end_points = { bots: '/bots', link: '/link', auth: '/auth' } }) => {
    const app = express();

    const instance = new Auth0rize({ url, key, secret });

    const router = express.Router();

    router.use(express.json());
    router.use(express.urlencoded({ extended: true }));

    router.use((req, res, next) => {
        Object.setPrototypeOf(req, app.request);
        Object.setPrototypeOf(res, app.response);
    
        req.res = res;
        res.req = req;
    
        next();
    });

    router.get(end_points.bots || '/bots', instance.bots());
    router.post(end_points.link || '/link', instance.link());
    
    router.post(end_points.auth || '/auth', instance.auth(onAuth));

    return router;
}


module.exports = {
    auth0rize
}