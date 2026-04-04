import fs from 'fs';
import https from 'https';

const url = 'https://raw.githubusercontent.com/dyllz92/Flexion-and-Flow-SOAP-Notes/main/src/index-monolithic.tsx';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    fs.writeFileSync('downloaded-soap.tsx', data);
    console.log('Downloaded successfully');
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
