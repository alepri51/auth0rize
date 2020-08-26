const axios = require('axios');
const jsonwebtoken = require('jsonwebtoken');

const express = require('express');

/* class Auth0rize {
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
} */

let _class = void 0;

if(typeof(window) === 'undefined') {
    //server side

    const axios = require('axios');
    class Auth0rize {
        constructor({ api_key, http_client = axios, processSignIn }) {
            this.tokens = {};

            this.api_key = api_key;
            this.processSignIn = processSignIn;

            const SSEChannel = require('sse-pubsub');
            this.channel = new SSEChannel();
        }

        middlewares(app) {
            app.get('/sse', this.sse);
            app.post('/apply', this.apply);
            app.get('/sources', this.sources);
            app.post('/create', this.create);
            app.post('/signIn', this.signIn);
        }

        sse(req, res) {
            return this.channel.subscribe(req, res);
        }

        apply(req, res) {
            //call from authorize.core.api
            let { token } = req.body;

            this.channel.publish(req.body, token);
        }

        sources(req, res) {
            //call authorize.core.api
        }

        create(req, res) {
            //call authorize.core.api
        }

        signIn(req, res) {
            //call authorize.core.api
            this.processSignIn && this.processSignIn();
        }
    }

    _class = Auth0rize;
}
else {
    //client side
    class Auth0rize {
        constructor({ base_url, onCreate, onSignIn }) {
            this.base_url = base_url;
            this.onCreate = onCreate;
            this.onSignIn = onSignIn;
        }

        async sources() {
            let response = await fetch({
                url: `${base_url}/auth0rize/sources`
            });

            return response.map(source => {
                let { _id, name } = source;

                return {
                    name,
                    request: async (link_type = 'web') => {
                        let response = await fetch({
                            method: 'POST',
                            url: `${base_url}/auth0rize/create`,
                            data: { _id, name, link_type }
                        });
                        
                        let { token } = response;

                        this.onCreate && this.onCreate(response); // return qr & link & token
                        this.eventSource = void 0;

                        if(window.EventSource) {
                            this.eventSource = new EventSource(`${base_url}/auth0rize/sse`);
                            
                            eventSource.addEventListener(token, async e => {
                                let response = await fetch({
                                    method: 'POST',
                                    url: `${base_url}/auth0rize/signin`,
                                    data: { token }
                                });

                                this.onSignIn && this.onSignIn(response);
                            });
                        }
                        
                    }
                }
            });
        }
    }

    _class = Auth0rize;
}

module.exports = _class;

/* module.exports = {
    auth0rize
} */