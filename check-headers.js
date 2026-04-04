import https from 'https';

https.get('https://flexion-and-flow-soap-notes-production.up.railway.app/', (res) => {
  console.log(res.headers);
});
