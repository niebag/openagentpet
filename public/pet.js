if (new URLSearchParams(location.search).get("reducedMotion") === "true") {
  const freeze = () => {
    const image = document.querySelector("img:target");
    if (!image) {
      setTimeout(freeze, 0);
      return;
    }

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
