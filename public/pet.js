const parameters = new URLSearchParams(location.search);
const image = document.querySelector("img");
image.src = parameters.get("asset") ?? "";
image.alt = `${decodeURIComponent(location.hash.slice(1)).replace("-", " ")} OpenAgentPet`;

if (parameters.get("reducedMotion") === "true") {
  const freeze = () => {
    const canvas = document.querySelector("canvas");
    const draw = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      image.hidden = true;
      canvas.hidden = false;
    };
    if (image.complete) draw();
    else image.addEventListener("load", draw, { once: true });
  };
  freeze();
}
