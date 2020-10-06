let _class = void 0;

if(typeof(window) === 'undefined') {
    //server side

    const axios = require('axios');
    const jsonwebtoken = require('jsonwebtoken');
    const UA = require('ua-parser-js').UAParser;

    const sse = require('moleculer.utils/sse');

    const { subscribe, publish } = sse();

    class Auth0rize {
        constructor({ url, api_key, secret, onMessage, onSignIn }) {
            this.api_key = api_key;
            this.secret = secret;

            this.onSignIn = onSignIn;
            this.onMessage = onMessage;

            this.auth0rize = axios.create({ baseURL: url });

            /* const SSEChannel = require('sse-pubsub');
            this.channel = new SSEChannel(); */

            //setInterval(() => this.channel.publish(`test data ${Date.now()}`, 'interval'), 1000);
        }

        get middlewares() {
            return [
                (req, res, next) => {
                    req.method === 'GET' && req.url.endsWith('/auth0rize.events') ? this.sse(req, res) : next();
                },
                (req, res, next) => {
                    req.method === 'POST' && req.url.endsWith('/auth0rize.message') ? this.message(req, res) : next();
                },
                (req, res, next) => {
                    req.method === 'POST' && req.url.endsWith('/auth0rize.sources') ? this.sources(req, res) : next();
                },
                /* (req, res, next) => {
                    req.method === 'POST' && req.url.endsWith('/auth0rize.request') ? this.request(req, res) : next();
                }, */
                (req, res, next) => {
                    req.method === 'POST' && req.url.endsWith('/auth0rize.signin') ? this.signin(req, res, next) : next();
                }
                //app.get('/auth0rize.sse', this.sse);
                //app.post('/auth0rize.signin', this.signin);
                //app.get('/auth0rize.sources', this.sources);
                //app.post('/auth0rize.request', this.request);
            ]
        }

        sse(req, res) {
            return subscribe(req, res);
        }

        async sources(req, res) {
            let { meta } = req.body;

            const { device } = (new UA(req.headers['user-agent'])).getResult();

            const mobile = device.type === 'mobile' ? true : false;

            let jwt = jsonwebtoken.sign({ api_key: this.api_key, mobile, meta }, this.secret);
                
            let { data } = await this.auth0rize.post('/client.sources', { jwt });

            res.json(data.content);

            return data;
        }

        /* async request(req, res) {
            let { bots, link_type, meta } = req.body;

            bots = bots.map(bot => {
                let jwt = jsonwebtoken.sign({ bot_id: bot, link_type, meta, api_key: this.api_key }, this.secret);
            
                return this.auth0rize.post('/client.request', { jwt });
            });
            
            bots = await Promise.all(bots);

            bots = bots.map(bot => bot.data.content);

            res.json(bots);
            
            return bots;
        } */

        async message(req, res) {
            let { contact, meta, token, source } = req.body;

            if(contact.system) {
                this.onSystemMessage && this.onSystemMessage(req.body);
            }

            let { reply, data = { contact, meta, token, source } } = this.onMessage ? await this.onMessage({ contact, meta, token, source }) : { reply: 'Welcome!' };

            let jwt = jsonwebtoken.sign(data, this.secret);

            res && res.end(reply);

            publish(jwt, token);

            return { reply, data };
        }

        signin(req, res, next) {
            let { jwt } = req.body;

            try {
                let message = jsonwebtoken.verify(jwt, process.env.AUTH0RIZE_SECRET);

                this.onSignIn ? this.onSignIn(req, res, message) : next();
            }
            catch(err) {
                throw { code: 422, message: 'Client verification failed.' };
            }
        }
    }

    _class = Auth0rize;
}
else {
    //client side
    class Auth0rize extends EventTarget {
        constructor({ url, onCreate, onSignIn }) {
            super();
            this.url = url;
            this.onCreate = onCreate;
            this.onSignIn = onSignIn;

            this.token = void 0;

            this.listener = async e => {
                let jwt = e.data;
                debugger
                let response = await fetch(`${this.url}/auth0rize.signin`, {
                    method: 'POST',
                    body: JSON.stringify({ jwt }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                response = response ? await response.json() : {};
                debugger
                let event = new CustomEvent('signin', { detail: response });

                this.dispatchEvent(event);

                this.eventSource.close();
                this.eventSource = void 0;
            }
        }

        async sources({ meta = {} } = {}) {
            if(window.EventSource && !this.eventSource) {
                this.eventSource = new EventSource(`${this.url}/auth0rize.events`);
            }
            
            let url = `${this.url}/auth0rize.sources`;

            let response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify({ meta }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            response =  response ? await response.json() : [];
            debugger

            let { token, sources } = response;
            
            const removeEventListener = (token) => {
                setTimeout(() => this.eventSource.removeEventListener(token, this.listener), 60000);
            }
            
            this.token && this.eventSource && removeEventListener(this.token);

            this.token = token;

            this.eventSource && this.eventSource.addEventListener(this.token, this.listener);

            return sources;
        }
    }

    _class = Auth0rize;
}

module.exports = _class;