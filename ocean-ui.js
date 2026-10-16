import * as THREE from 'three';

export function setupOceanUI({ scene, camera, controls, gui, uniforms, params, setPaused, getPaused }) {
    const guide = document.getElementById('fieldGuide');
    const stats = document.getElementById('performance');
    const guideButton = document.getElementById('guideButton');
    const statsButton = document.getElementById('statsButton');
    const settingsButton = document.getElementById('settingsButton');
    const pauseButton = document.getElementById('pauseButton');
    const tourButton = document.getElementById('tourButton');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const moods = {
        day: { fog: 0x247b89, upper: 0x5cbfbb, lower: 0x063c57, sun: 0xfff1c9, intensity: 3.6, ambient: 1.3, exposure: 1.02, bloom: 0.18, ray: 1, label: '珊瑚礁谷 · 日光穿过浅海' },
        dusk: { fog: 0x3e7185, upper: 0xb89d8d, lower: 0x173d60, sun: 0xffb77f, intensity: 2.8, ambient: 1.1, exposure: 1.02, bloom: 0.25, ray: 0.65, label: '暮色海湾 · 最后一缕暖流' },
        deep: { fog: 0x082b53, upper: 0x174c70, lower: 0x03182f, sun: 0x6baacf, intensity: 1.1, ambient: 0.65, exposure: 0.98, bloom: 0.6, ray: 0.16, label: '荧光深蓝 · 聆听海的夜晚' }
    };
    const initialPosition = camera.position.clone();
    const initialTarget = controls.target.clone();
    let mood = 'day';
    let panel = null;
    let resetProgress = 1;
    let resetPosition = initialPosition.clone();
    let resetTarget = initialTarget.clone();

    gui.hide();
    function closePanels() {
        guide.hidden = true;
        stats.classList.remove('visible');
        gui.hide();
        for (const button of [guideButton, statsButton, settingsButton]) button.setAttribute('aria-expanded', 'false');
        panel = null;
    }
    function togglePanel(name) {
        const opening = panel !== name;
        closePanels();
        if (!opening) return;
        panel = name;
        if (name === 'guide') { guide.hidden = false; guideButton.setAttribute('aria-expanded', 'true'); }
        if (name === 'stats') { stats.classList.add('visible'); statsButton.setAttribute('aria-expanded', 'true'); }
        if (name === 'settings') { gui.show(); settingsButton.setAttribute('aria-expanded', 'true'); }
    }
    function updatePause() {
        const paused = getPaused();
        pauseButton.setAttribute('aria-pressed', String(paused));
        pauseButton.setAttribute('aria-label', paused ? '继续生态' : '暂停生态');
        pauseButton.title = paused ? '继续生态 · 空格' : '暂停生态 · 空格';
        pauseButton.innerHTML = paused
            ? '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';
    }
    function togglePause() { setPaused(!getPaused()); updatePause(); }
    function setPhoto(enabled) {
        document.body.classList.toggle('photo-mode', enabled);
        if (enabled) closePanels();
    }
    function resetView() {
        controls.autoRotate = false;
        tourButton.setAttribute('aria-pressed', 'false');
        resetPosition.copy(camera.position);
        resetTarget.copy(controls.target);
        resetProgress = reducedMotion ? 1 : 0;
        if (reducedMotion) { camera.position.copy(initialPosition); controls.target.copy(initialTarget); }
    }
    guideButton.addEventListener('click', () => togglePanel('guide'));
    statsButton.addEventListener('click', () => togglePanel('stats'));
    settingsButton.addEventListener('click', () => togglePanel('settings'));
    pauseButton.addEventListener('click', togglePause);
    tourButton.addEventListener('click', () => {
        controls.autoRotate = !controls.autoRotate;
        controls.autoRotateSpeed = 0.3;
        tourButton.setAttribute('aria-pressed', String(controls.autoRotate));
    });
    document.getElementById('photoButton').addEventListener('click', () => setPhoto(true));
    document.querySelectorAll('[data-mood]').forEach(button => {
        button.addEventListener('click', () => {
            mood = button.dataset.mood;
            document.querySelectorAll('[data-mood]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
            document.getElementById('locationLabel').textContent = moods[mood].label;
            params.sunIntensity = moods[mood].intensity;
            params.bloomStrength = moods[mood].bloom;
            gui.controllersRecursive().forEach(controller => controller.updateDisplay());
        });
    });
    window.addEventListener('keydown', event => {
        if (event.target.closest('input, textarea, select, [contenteditable="true"]') || event.repeat) return;
        if (event.code === 'Space' && !event.target.closest('button, summary')) { event.preventDefault(); togglePause(); }
        if (event.code === 'KeyP') setPhoto(!document.body.classList.contains('photo-mode'));
        if (event.code === 'KeyR') resetView();
        if (event.code === 'Escape') { setPhoto(false); closePanels(); }
    });
    controls.domElement.addEventListener('dblclick', () => {
        if (document.body.classList.contains('photo-mode')) setPhoto(false);
        else resetView();
    });
    controls.addEventListener('start', () => {
        controls.autoRotate = false;
        tourButton.setAttribute('aria-pressed', 'false');
        resetProgress = 1;
        document.getElementById('controlsHint').classList.add('faded');
        closePanels();
    });
    setTimeout(() => document.getElementById('controlsHint').classList.add('faded'), 12000);
    const targetColor = new THREE.Color();
    return {
        update(delta, renderer) {
            const selected = moods[mood];
            const blend = reducedMotion ? 1 : 1 - Math.exp(-delta * 2.5);
            scene.fog.color.lerp(targetColor.setHex(selected.fog), blend);
            scene.userData.sunLight.color.lerp(targetColor.setHex(selected.sun), blend);
            scene.userData.sunLight.intensity = params.sunIntensity;
            scene.userData.ambientLight.intensity = THREE.MathUtils.lerp(scene.userData.ambientLight.intensity, selected.ambient, blend);
            renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, selected.exposure, blend);
            if (scene.userData.bloomPass) scene.userData.bloomPass.strength = params.bloomStrength;
            uniforms.glow.value = THREE.MathUtils.lerp(uniforms.glow.value, mood === 'deep' ? 0.32 : 0.055, blend);
            uniforms.ray.value = THREE.MathUtils.lerp(uniforms.ray.value, selected.ray, blend);
            uniforms.caustics.value = params.causticsEnabled ? selected.ray : 0;
            const art = scene.getObjectByName('Reef art direction');
            if (art) {
                art.traverse(object => {
                    const shaderUniforms = object.material?.uniforms;
                    if (shaderUniforms?.upper) {
                        shaderUniforms.upper.value.lerp(targetColor.setHex(selected.upper), blend);
                        shaderUniforms.lower.value.lerp(targetColor.setHex(selected.lower), blend);
                    }
                });
            }
            if (resetProgress < 1) {
                resetProgress = Math.min(1, resetProgress + delta * 1.3);
                const easing = resetProgress * resetProgress * (3 - 2 * resetProgress);
                camera.position.lerpVectors(resetPosition, initialPosition, easing);
                controls.target.lerpVectors(resetTarget, initialTarget, easing);
            }
        },
        syncPause: updatePause,
        getMood: () => mood
    };
}
