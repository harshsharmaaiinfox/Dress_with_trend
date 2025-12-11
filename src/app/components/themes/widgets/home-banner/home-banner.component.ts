import { Component, Input, ViewChild, AfterViewInit } from '@angular/core';
import { OwlOptions, CarouselComponent } from 'ngx-owl-carousel-o';

@Component({
  selector: 'app-theme-home-banner',
  templateUrl: './home-banner.component.html',
  styleUrls: ['./home-banner.component.scss']
})
export class HomeBannerComponent implements AfterViewInit {

  @Input() theme: string = 'paris';
  @Input() data: any;
  @ViewChild('owlCarousel') owlCarousel: CarouselComponent;

  // Slider images
  public sliderImages = [
    'assets/images/dress1.png',
    'assets/images/dress2.png'
  ];

  // Owl Carousel options for hero slider
  heroSliderOptions: OwlOptions = {
    loop: false,
    rewind: true,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: true,
    dots: true,
    nav: false,
    autoplay: true,
    autoplayTimeout: 5000,
    autoplayHoverPause: true,
    autoplaySpeed: 1000,
    smartSpeed: 1000,
    items: 1,
    margin: 0,
    responsive: {
      0: {
        items: 1
      }
    }
  };

  ngAfterViewInit() {
    // Hide extra dots after carousel initializes
    setTimeout(() => {
      this.hideExtraDots();
    }, 200);

    // Listen to carousel events to hide dots when it updates
    if (this.owlCarousel) {
      this.owlCarousel.translated.subscribe(() => {
        setTimeout(() => {
          this.hideExtraDots();
        }, 50);
      });
    }
  }

  private hideExtraDots() {
    const dotsContainer = document.querySelector('.banner-home .owl-dots');
    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('.owl-dot');
      if (dots.length > 2) {
        dots.forEach((dot, index: number) => {
          if (index >= 2) {
            const htmlDot = dot as HTMLElement;
            htmlDot.style.display = 'none';
            htmlDot.style.visibility = 'hidden';
            htmlDot.style.opacity = '0';
            htmlDot.style.width = '0';
            htmlDot.style.height = '0';
            htmlDot.style.margin = '0';
            htmlDot.style.padding = '0';
          }
        });
      }
    }
  }
  
}
