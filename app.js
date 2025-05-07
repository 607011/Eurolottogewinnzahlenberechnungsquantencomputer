/*
   Copyright (c) 2024 Oliver Lau, oliver@ersatzworld.net
*/

(function (window) {
    "use strict";

    const AnimationDurationMs = Math.floor(451 * 1.4);

    const fps = new Array(5).fill(0);
    let el = {};
    let allLamps = [];
    let running = true;
    let lastT = 0;
    let tIdx = 0;
    let opacity = null; // will be set to WASM function in loadWASM()

    function markBrightestLamps(selector, n) {
        let brighestLamps = [];
        for (const field of document.querySelectorAll(selector)) {
            let maxOpacity = Number.MIN_VALUE;
            let brightestLamp = null;
            for (const lamp of field.querySelectorAll('.lamp')) {
                const opacity = parseFloat(lamp.style.opacity);
                if (opacity > maxOpacity) {
                    brightestLamp = lamp;
                    maxOpacity = opacity;
                }
            }
            brighestLamps.push({
                opacity: maxOpacity,
                el: brightestLamp,
            });
            brightestLamp.classList.add('marked');
        }
        brighestLamps.sort((a, b) => {
            return b.opacity - a.opacity;
        });
        brighestLamps.slice(0, n).forEach(lamp => {
            lamp.el.parentElement.querySelector('.number').classList.add('visible');
        });
    };

    function measure(e) {
        running = false;
        markBrightestLamps('#ticket .left .field', 5);
        markBrightestLamps('#ticket .right .field', 2);
        e.target.setAttribute('disabled', true);
        e.target.style.cursor = 'not-allowed';
        e.target.removeEventListener('click', measure);
        el.fps.style.display = 'none';
    }

    const mt = {
        randint: null,
        seed: null,
        seed_seq: null,
    };

    function buildTicketPart(side, n) {
        const part = document.querySelector(`#ticket .${side}`);
        for (let i = 0; i < n; ++i) {
            const field = document.createElement('span');
            field.className = 'field';
            const number = document.createElement('span');
            number.textContent = `${i + 1}`;
            number.className = 'number';
            field.append(number);
            for (let j = 0; j < n; ++j) {
                const lamp = document.createElement('span');
                lamp.className = 'lamp';
                field.append(lamp);
                allLamps.push({
                    el: lamp,
                    offset: mt.randint() % AnimationDurationMs,
                    animationDuration: AnimationDurationMs - (200 / n) * (mt.randint() % (j + 1)),
                });
            }
            part.append(field);
        }
    }

    function update(t) {
        if (!running)
            return;
        allLamps.forEach(lamp => {
            lamp.el.style.opacity = opacity(lamp.offset, t, lamp.animationDuration);
        });
        window.requestAnimationFrame(update);
    }

    async function init(wasmInstance) {
        opacity = wasmInstance.exports.opacity;
        mt.n = wasmInstance.exports.n();
        mt.seed = wasmInstance.exports.init_genrand;
        mt.seed_seq = wasmInstance.exports.init_by_array;
        mt.randint = wasmInstance.exports.genrand_int31;

        const BUFSIZE = mt.n;
        const seeds = new Uint32Array(BUFSIZE);
        crypto.getRandomValues(seeds);
        const memory = wasmInstance.exports.memory;
        const memView = new Uint32Array(memory.buffer);
        seeds.forEach((val, idx) => memView[idx] = val);
        mt.seed_seq(memView.byteOffset, BUFSIZE);
        buildTicketPart("left", 50);
        buildTicketPart("right", 12);
    }

    function run() {
        window.requestAnimationFrame(update);
    }

    async function loadWASM() {
        let instance;
        try {
            instance = (await WebAssembly.instantiateStreaming(fetch('MT/MT.wasm'))).instance;
        }
        catch (e) {
            return Promise.reject(e);
        }
        return instance;
    }

    function main() {
        el.measureButton = document.querySelector('#measure-button');
        el.measureButton.addEventListener('click', measure);
        el.fps = document.querySelector('#fps');
        loadWASM()
            .then(init)
            .then(run)
            .catch(e => console.error(e));
    }

    window.addEventListener('load', main);

})(window);
