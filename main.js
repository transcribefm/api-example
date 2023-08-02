import './style.css';

const url = document.querySelector('#url');
const progress = document.querySelector('#progress');
const progressInvoice = document.querySelector('#progressInvoice');
const progressPay = document.querySelector('#progressPay');
const progressTranscribe = document.querySelector('#progressTranscribe');
const progressFetch = document.querySelector('#progressFetch');
const progressView = document.querySelector('#progressView');
const submit = document.querySelector('#submit');
const sleep = (m) => new Promise((r) => setTimeout(r, m));

function getDurationInSeconds(remoteUrl, callback) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(remoteUrl);

    audio.addEventListener('loadedmetadata', function () {
      resolve(audio.duration);
    });

    audio.addEventListener('error', function () {
      reject('Could not determine audio duration');
    });
  });
}

submit.addEventListener('click', async () => {
  if (typeof window.webln === 'undefined') {
    return alert('No WebLN available.');
  }

  try {
    await window.webln.enable();
  } catch (error) {
    return alert('User denied permission or cancelled.');
  }

  try {
    // show #progress
    progress.classList.remove('hidden');
    /* UI Progress Logic */
    const durationInSeconds = await getDurationInSeconds(url.value);
    progressInvoice.classList.replace('next', 'current');

    const quote = await fetch('https://transcribe.fm/api/v1/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: url.value }),
    });
    // NOTE: expect 402 status code
    const authHeader = quote.headers.get('WWW-Authenticate');

    if (!authHeader) {
      throw new Error('No WWW-Authenticate header');
    }

    /* UI Progress Logic */
    progressInvoice.classList.replace('current', 'complete');
    progressPay.classList.replace('next', 'current');

    const macaroon = authHeader.split('macaroon="')[1].split('"')[0];
    const invoice = authHeader.split('invoice="')[1].split('"')[0];

    const payment = await window.webln.sendPayment(invoice);
    const preimage = payment.preimage;

    /* UI Progress Logic */
    progressPay.classList.replace('current', 'complete');
    progressTranscribe.classList.replace('next', 'current');

    const transcript = await fetch('https://transcribe.fm/api/v1/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `L402 ${macaroon}:${preimage}`,
      },
      body: JSON.stringify({ audio_url: url.value }),
    });

    if (transcript.status === 200) {
      /* UI Progress Logic */
      progressTranscribe.classList.replace('current', 'complete');
      progressFetch.classList.replace('next', 'current');

      const { transcript_id } = await transcript.json();

      // wait 1/120th of the duration + 2 second
      await sleep((durationInSeconds / 120) * 1000 + 2000);
      // fetch txt file
      const text = await fetch(
        `https://transcribe.fm/transcript/${transcript_id}.txt`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'text/plain',
          },
        }
      );

      const interval = setInterval(() => {
        fetch(`/transcript/${fileName}.txt`).then((response) => {
          // The API call was successful!
          if (response.ok) {
            document.querySelector(
              '#results'
            ).innerHTML = `<pre>${response.text()}</pre>`;
          }
        });
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
      }, 5 * 60 * 1000); // 5 minutes

      /* UI Progress Logic */
      progressFetch.classList.replace('current', 'complete');
      progressView.classList.replace('next', 'current');

      // return text
      document.querySelector(
        '#results'
      ).innerHTML = `<pre>${await text.text()}</pre>`;

      /* UI Progress Logic */
      progressView.classList.replace('current', 'complete');
    } else {
      const err = await transcript.text();
      throw new Error(err);
    }
  } catch (error) {
    /* UI Progress Logic */
    document
      .querySelector('#progress .current')
      .classList.replace('current', 'error');

    console.log(error);
  }
});
