const input = document.getElementById("input");
const canvasContainer = document.getElementById("canvas-container");
const loading = document.getElementById("loading");

const twoify = (n) => Math.pow(2, Math.floor(Math.log2(n)));

let rgbMatrix = [];

document.body.focus();
document.body.addEventListener("paste", (event) => {
  const items = event.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
      const blob = items[i].getAsFile();
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File([blob], "pasted-image.png", { type: blob.type })
      );
      input.files = dataTransfer.files;
      input.dispatchEvent(
        new Event("change", {
          bubbles: true,
          target: { files: input.files },
        })
      );
    }
  }
});

input.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  loading.style.display = "block";

  const reader = new FileReader();
  reader.onload = function (e) {
    const image = new Image();
    image.onload = function () {
      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d");

      let side = twoify(Math.min(image.width * 2, image.height * 2));
      canvas.width = side;
      canvas.height = side;
      ctx.scale(side / image.width, side / image.height);
      ctx.drawImage(image, 0, 0);

      // Display the original image for 2 seconds
      setTimeout(() => {
        const imageData = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        ).data;

        rgbMatrix = [];
        for (let y = 0; y < side; y++) {
          const row = [];
          for (let x = 0; x < side; x++) {
            const index = (y * side + x) * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];
            row.push([r, g, b]);
          }
          rgbMatrix.push(row);
        }
        start(side);
      }, 2000);
    };

    image.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

async function start(side) {
  const canvas = document.getElementById("canvas");
  canvas.width = side;
  canvas.height = side;

  const ctx = canvas.getContext("2d");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rgbMatrix.length; y++) {
    for (let x = 0; x < rgbMatrix[y].length; x++) {
      const [r, g, b] = rgbMatrix[y][x];

      const index = (y * canvas.width + x) * 4;
      imageData.data[index] = r;
      imageData.data[index + 1] = g;
      imageData.data[index + 2] = b;
      imageData.data[index + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  await new Promise((r) => setTimeout(r, 1000));

  const queue = [{ x: 0, y: 0, side: rgbMatrix.length }];
  while (queue.length > 0) {
    const { x, y, side } = queue.shift();

    const region = sliceRegion(x, y, side);

    function avg(numbers) {
      return numbers.reduce((acc, num) => acc + num, 0) / numbers.length;
    }

    const avgColor = [
      Math.floor(avg(region.map((v) => v[0]))),
      Math.floor(avg(region.map((v) => v[1]))),
      Math.floor(avg(region.map((v) => v[2]))),
    ];

    ctx.fillStyle = rgbToHex(...avgColor);
    ctx.fillRect(x, y, side, side);
    ctx.lineWidth = 0.2;
    ctx.strokeRect(x, y, side, side);

    const percentOutsideRange = percent(region, avgColor, [32, 32, 32]);

    const done = percentOutsideRange < 0.01;

    const half = Math.round(side / 2);
    if (!done && half > 2) {
      const q1 = { x: x, y: y, side: half };
      const q2 = { x: x + half, y: y, side: half };
      const q3 = { x: x + half, y: y + half, side: half };
      const q4 = { x: x, y: y + half, side: half };

      queue.push(q1, q2, q3, q4);
    }
  }

  loading.style.display = "none";
}

function percent(rgbs, mean, range) {
  let countWithinRange = 0;

  for (let rgb of rgbs) {
    let [r, g, b] = rgb;
    let isOutsideRange =
      Math.abs(r - mean[0]) > range[0] &&
      Math.abs(g - mean[1]) > range[1] &&
      Math.abs(b - mean[2]) > range[2];

    if (isOutsideRange) {
      countWithinRange++;
    }
  }

  return countWithinRange / rgbs.length;
}

function sliceRegion(x, y, s) {
  return rgbMatrix
    .slice(y, y + s)
    .map((row) => row.slice(x, x + s))
    .flat(1);
}

function rgbToHex(r, g, b) {
  let hexR = r.toString(16).padStart(2, "0");
  let hexG = g.toString(16).padStart(2, "0");
  let hexB = b.toString(16).padStart(2, "0");
  return `#${hexR}${hexG}${hexB}`;
}
