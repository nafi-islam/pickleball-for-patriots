"use client";

import { Carousel } from "antd";
import Image from "next/image";

const images = [
  "/assets/pickleball-1.jpg",
  "/assets/pickleball-2.jpg",
  "/assets/pickleball-3.jpg",
];

export default function ImageCarousel() {
  return (
    <Carousel autoplay dots className="rounded-2xl overflow-hidden shadow-lg">
      {images.map((src) => (
        <div key={src} className="relative h-64 sm:h-80 md:h-96">
          <Image
            src={src}
            alt="Pickleball action"
            fill
            className="object-cover"
            priority={src === images[0]}
          />
        </div>
      ))}
    </Carousel>
  );
}
