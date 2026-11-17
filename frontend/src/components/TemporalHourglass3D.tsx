import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * TemporalHourglass3D
 * Signature 3D interactive temporal artifact for EpoClaim:
 * - Deep emerald-green tinted glass with optical refraction & thickness
 * - Champagne-gold metallic Möbius ribbon & armature rings
 * - Electric-violet central temporal core with pulsing interior radiance
 * - Subtle inner particle flow / falling starlight representing the decay and flux of claims
 * - Responsive pointer parallax and gentle idle rotation
 * - Mobile performance-adapted rendering (clamped pixelRatio, optimized particle count & geometry)
 * - IntersectionObserver to halt rendering when offscreen
 * - Graceful WebGL error detection and static transparent PNG fallback
 */

export function TemporalHourglass3D() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasWebGLError, setHasWebGLError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.innerWidth <= 768;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReducedMotion = mediaQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    mediaQuery.addEventListener("change", handleMotionChange);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, isMobile ? 6.8 : 6.4);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobile, // Disable MSAA on mobile to conserve GPU fillrate
        powerPreference: isMobile ? "default" : "high-performance",
      });
      // Clamp pixelRatio: 1 on mobile, up to 2 on desktop
      renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
    } catch {
      queueMicrotask(() => setHasWebGLError(true));
      return;
    }

    const domElement = renderer.domElement;
    domElement.style.width = "100%";
    domElement.style.height = "100%";
    domElement.style.display = "block";
    container.appendChild(domElement);

    // Main rotating group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Emerald Glass Hourglass Vessel (LatheGeometry)
    // ──────────────────────────────────────────────────────────────────────────
    const lathePoints: THREE.Vector2[] = [];
    const segments = isMobile ? 26 : 45;
    const height = 2.9;
    const waistRadius = 0.22;
    const bellRadius = 1.12;

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * 2 - 1; // -1 to +1
      const r = waistRadius + (bellRadius - waistRadius) * Math.pow(Math.abs(t), 1.6);
      lathePoints.push(new THREE.Vector2(r, t * (height * 0.5)));
    }

    const latheGeom = new THREE.LatheGeometry(lathePoints, isMobile ? 32 : 48);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(isMobile ? "#1A6B4A" : "#0E4631"),
      emissive: new THREE.Color(isMobile ? "#0D5C3A" : "#031A10"),
      emissiveIntensity: isMobile ? 0.65 : 1.0,
      roughness: 0.08,
      metalness: 0.15,
      transmission: isMobile ? 0.78 : 0.84,
      thickness: isMobile ? 1.2 : 1.6,
      ior: 1.54,
      transparent: true,
      opacity: isMobile ? 0.95 : 0.92,
      reflectivity: 0.9,
      side: THREE.DoubleSide,
    });

    const glassMesh = new THREE.Mesh(latheGeom, glassMat);
    rootGroup.add(glassMesh);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Champagne Metallic Möbius Ribbon & Orbit Ring
    // ──────────────────────────────────────────────────────────────────────────
    const goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#E8D9B9"),
      roughness: 0.28,
      metalness: 0.82,
    });

    // Outer Target Reticle Ring
    const reticleGeom = new THREE.TorusGeometry(1.48, 0.035, isMobile ? 16 : 24, isMobile ? 48 : 72);
    const reticleMesh = new THREE.Mesh(reticleGeom, goldMat);
    reticleMesh.rotation.x = Math.PI * 0.5;
    rootGroup.add(reticleMesh);

    // Dynamic S-Curved Helical Ribbon
    const curvePoints: THREE.Vector3[] = [];
    const ribbonSegments = isMobile ? 60 : 120;
    for (let i = 0; i <= ribbonSegments; i++) {
      const u = (i / ribbonSegments) * Math.PI * 2.8 - Math.PI * 1.4;
      const rx = Math.sin(u) * (0.95 + 0.35 * Math.abs(u / (Math.PI * 1.4)));
      const ry = (u / (Math.PI * 1.4)) * 1.45;
      const rz = Math.cos(u) * 0.95;
      curvePoints.push(new THREE.Vector3(rx, ry, rz));
    }
    const ribbonCurve = new THREE.CatmullRomCurve3(curvePoints);
    const ribbonGeom = new THREE.TubeGeometry(ribbonCurve, isMobile ? 48 : 80, 0.065, isMobile ? 8 : 12, false);
    const ribbonMesh = new THREE.Mesh(ribbonGeom, goldMat);
    rootGroup.add(ribbonMesh);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Central Electric Violet Core & Internal Star
    // ──────────────────────────────────────────────────────────────────────────
    const coreGroup = new THREE.Group();
    rootGroup.add(coreGroup);

    // Core pulsing star
    const starGeom = new THREE.OctahedronGeometry(0.24, 1);
    const starMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#C084FC"),
      wireframe: false,
    });
    const starMesh = new THREE.Mesh(starGeom, starMat);
    coreGroup.add(starMesh);

    // Interior Violet Aura Glow
    const auraGeom = new THREE.SphereGeometry(0.42, isMobile ? 16 : 24, isMobile ? 16 : 24);
    const auraMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#8B5CF6"),
      transparent: true,
      opacity: 0.45,
    });
    const auraMesh = new THREE.Mesh(auraGeom, auraMat);
    coreGroup.add(auraMesh);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Starlight Internal Particles
    // ──────────────────────────────────────────────────────────────────────────
    const particleCount = isMobile ? 45 : 140;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const y = (Math.random() * 2 - 1) * (height * 0.45);
      const normY = (y / (height * 0.5));
      const maxR = waistRadius + (bellRadius - waistRadius) * Math.pow(Math.abs(normY), 1.6) * 0.75;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * maxR;

      particlePositions[i3] = Math.cos(theta) * r;
      particlePositions[i3 + 1] = y;
      particlePositions[i3 + 2] = Math.sin(theta) * r;
      particleVelocities[i] = 0.004 + Math.random() * 0.008;
    }

    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: new THREE.Color("#FDF6B2"),
      size: isMobile ? 0.035 : 0.045,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeom, particleMat);
    rootGroup.add(particleSystem);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Cinematic Lighting Environment
    // ──────────────────────────────────────────────────────────────────────────
    const emeraldKeyLight = new THREE.DirectionalLight(new THREE.Color("#10B981"), isMobile ? 3.2 : 2.2);
    emeraldKeyLight.position.set(4, 5, 3);
    scene.add(emeraldKeyLight);

    const violetRimLight = new THREE.DirectionalLight(new THREE.Color("#A855F7"), isMobile ? 2.6 : 1.8);
    violetRimLight.position.set(-4, -3, -3);
    scene.add(violetRimLight);

    const goldTopLight = new THREE.PointLight(new THREE.Color("#FDE68A"), isMobile ? 2.0 : 1.2, 8);
    goldTopLight.position.set(0, 3, 1);
    scene.add(goldTopLight);

    const ambientLight = new THREE.AmbientLight(new THREE.Color("#064E3B"), isMobile ? 1.4 : 0.8);
    scene.add(ambientLight);

    // Smooth Pointer Parallax tracking
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetRotY = nx * 0.45;
      targetRotX = -ny * 0.35 + 0.1;
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    // Handle Resize
    const updateSize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    // IntersectionObserver & Visibility Handling to pause when offscreen
    let isVisible = true;
    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting && !document.hidden;
    }, { threshold: 0.1 });
    io.observe(container);

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Animation Loop
    // ──────────────────────────────────────────────────────────────────────────
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Idle floating oscillation
        const floatY = Math.sin(elapsed * 1.2) * 0.08;
        rootGroup.position.y = floatY;

        // Smooth spring interpolation towards pointer parallax
        currentRotX += (targetRotX - currentRotX) * 0.06;
        currentRotY += (targetRotY - currentRotY) * 0.06;

        rootGroup.rotation.x = currentRotX + Math.sin(elapsed * 0.8) * 0.04;
        rootGroup.rotation.y = currentRotY + elapsed * 0.15; // Slow turntable

        // Core star counter-rotation & breath pulse
        starMesh.rotation.y = -elapsed * 0.9;
        starMesh.rotation.z = elapsed * 0.6;
        const pulse = 1 + Math.sin(elapsed * 3) * 0.12;
        starMesh.scale.set(pulse, pulse, pulse);
        auraMesh.scale.set(1 + Math.sin(elapsed * 2.5) * 0.15, 1 + Math.sin(elapsed * 2.5) * 0.15, 1 + Math.sin(elapsed * 2.5) * 0.15);

        // Particle descent
        const posAttr = particleGeom.getAttribute("position") as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          arr[i3 + 1] -= particleVelocities[i];
          if (arr[i3 + 1] < -1.4) {
            arr[i3 + 1] = 1.4;
          }
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handlePointerMove);
      mediaQuery.removeEventListener("change", handleMotionChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver.disconnect();
      io.disconnect();

      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
      renderer.dispose();
      latheGeom.dispose();
      glassMat.dispose();
      goldMat.dispose();
      reticleGeom.dispose();
      ribbonGeom.dispose();
      starGeom.dispose();
      starMat.dispose();
      auraGeom.dispose();
      auraMat.dispose();
      particleGeom.dispose();
      particleMat.dispose();
    };
  }, []);

  return (
    <div className="temporal-hourglass-viewport" ref={containerRef} aria-hidden="true">
      {hasWebGLError && (
        <img
          src="/epoclaim-symbol.png"
          alt="EpoClaim Temporal Emblem"
          className="hourglass-static-fallback"
        />
      )}
    </div>
  );
}
