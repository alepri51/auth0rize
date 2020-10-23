let _class = void 0;

if(typeof(window) === 'undefined') {
    //server side

    const axios = require('axios');
    const jsonwebtoken = require('jsonwebtoken');
    const UA = require('ua-parser-js').UAParser;

    const SSE = require('sse');

    class Auth0rize {
        constructor({ 
            url, 
            api_key, 
            secret,
            ttl = 60,
            onMessage, 
            onSystemMessage, 
            onSignIn, 
            onSources, 
            redis: { pub, sub } = {}
        }) {
            this.api_key = api_key;
            this.secret = secret;
            this.ttl = ttl;

            this.onSources = onSources;
            this.onSignIn = onSignIn;
            this.onMessage = onMessage;
            this.onSystemMessage = onSystemMessage;

            this.auth0rize = axios.create({ baseURL: url });

            this.sse = SSE({ pub, sub });

            /* this.sseChannel = (req, res) => {
                return this.sse.subscribe(req, res, req.query.channel);
            }

            this.sources = async (req, res) => {
                req = req || { body: {}, headers: { 'user-agent': 'Mozila' } };
    
                let { meta } = req.body;
    
                const { device } = (new UA(req.headers['user-agent'])).getResult();
    
                const mobile = device.type === 'mobile' ? true : false;
    
                let jwt = jsonwebtoken.sign({ api_key: this.api_key, mobile, meta }, this.secret);
                    
                let { data } = await this.auth0rize.post('/client.sources', { jwt });
    
                res.json(data.content);
    
                return data;
            }

            this.message = async (req, res) => {
                let { contact, meta, token, source } = req.body;
    
                if(contact.system) {
                    this.onSystemMessage && this.onSystemMessage(req.body);
    
                    return {};
                }
    
                let { reply, data = { contact, meta, token, source } } = this.onMessage ? await this.onMessage({ contact, meta, token, source }) : { reply: 'Welcome!' };
    
                let jwt = jsonwebtoken.sign(data, this.secret);
    
                res && res.end(reply);
    
                let publish = this.sse.clients[token];
                publish && publish(token, jwt);
    
                return { reply, data };
            }

            this.signin = (req, res, next) => {
                let { jwt } = req.body;
    
                try {
                    let message = jsonwebtoken.verify(jwt, this.secret);
    
                    this.onSignIn ? this.onSignIn(req, res, message) : next();
    
                    res && res.end();
                }
                catch(err) {
                    throw { code: 422, message: 'Client verification failed.' };
                }
            } */
        }

        get middlewares() {
            return [
                (req, res, next) => {
                    req.method === 'GET' && req.url.includes('/auth0rize.events?channel=') ? this.sseChannel(req, res) : next();
                },
                (req, res, next) => {
                    req.method === 'POST' && req.url.endsWith('/auth0rize.message') ? this.message(req, res) : next();
                },
                (req, res, next) => {
                    req.method === 'POST' && req.url.endsWith('/auth0rize.sources') ? this.sources(req, res) : next();
                },
                (req, res, next) => {
                    req.method === 'POST' && req.url.endsWith('/auth0rize.signin') ? this.signin(req, res, next) : next();
                }
            ]
        }

        sseChannel(req, res) {
            return this.sse.subscribe(req, res, req.query.channel);
        }

        async sources(req, res) {
            req = req || { body: {}, headers: { 'user-agent': 'Mozila' } };

            let { meta } = req.body;

            const { device } = (new UA(req.headers['user-agent'])).getResult();

            const mobile = device.type === 'mobile' ? true : false;

            let jwt = jsonwebtoken.sign({ api_key: this.api_key, mobile, meta }, this.secret);
                
            let ttl = this.ttl || 60;

            let { data } = await this.auth0rize.post('/client.sources', { jwt, ttl });

            let sources = data.content;

            sources = this.onSources ? await this.onSources(sources) : sources;

            res.json(sources);

            return data;
        }

        async message(req, res) {
            let { contact, meta, token, source } = req.body;

            if(contact.system) {
                this.onSystemMessage && this.onSystemMessage(req.body);

                return {};
            }

            let { reply, data = { contact, meta, token, source } } = this.onMessage ? await this.onMessage({ contact, meta, token, source }) : { reply: 'Welcome!' };

            let jwt = jsonwebtoken.sign(data, this.secret);

            res && res.end(reply);

            let publish = this.sse.clients[token];
            publish && publish(token, jwt);

            return { reply, data };
        }

        signin(req, res, next) {
            let { jwt } = req.body;

            try {
                let message = jsonwebtoken.verify(jwt, this.secret);

                this.onSignIn ? this.onSignIn(req, res, message) : next();

                res && res.end();
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
        constructor({ url, ttl, onCreate, onSignIn }) {
            super();
            this.url = url;
            this.ttl = ttl;
            this.onCreate = onCreate;
            this.onSignIn = onSignIn;

            this.token = void 0;
            this.channel = Date.now();

            this.listener = async e => {
                let jwt = e.data;

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
            }
        }

        async sources({ meta = {} } = {}) {
            let url = `${this.url}/auth0rize.sources`;

            let response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify({ meta }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            response =  response ? await response.json() : [];

            let { token, sources } = response;

            if(window.EventSource) {
                let eventSource = new EventSource(`${this.url}/auth0rize.events?channel=${token}`);

                eventSource.addEventListener(token, this.listener);

                setTimeout(() => {
                    eventSource.removeEventListener(token, this.listener);

                    eventSource.close();

                    eventSource = void 0;
                }, this.ttl);
            }

            return sources;
        }
    }

    _class = Auth0rize;
}

module.exports = _class;