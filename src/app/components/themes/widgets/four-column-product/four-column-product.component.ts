import { Component, Input } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OwlOptions } from 'ngx-owl-carousel-o';
import { Product, ProductModel } from '../../../../shared/interface/product.interface';
import { SliderProductsTokyo } from '../../../../shared/interface/theme.interface';
import { ProductState } from '../../../../shared/state/product.state';

@Component({
  selector: 'app-four-column-product',
  templateUrl: './four-column-product.component.html',
  styleUrls: ['./four-column-product.component.scss']
})
export class FourColumnProductComponent {

  @Input() data?: SliderProductsTokyo;
  @Input() col: string;

  @Select(ProductState.product) product$: Observable<ProductModel>;

  getProducts(ids: number[]) {
    if (Array.isArray(ids)) {
      let filteredProducts: Product[] = [];
      this.product$.subscribe(products => {
        filteredProducts = products.data.filter(product => ids?.includes(product?.id!));
      });
      return filteredProducts;
    } return
  }


  // Owl Carousel options
  sliderOption: OwlOptions = {
    loop: true,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: true,
    dots: true,
    navSpeed: 700,
    navText: ['<i class="ri-arrow-left-s-line"></i>', '<i class="ri-arrow-right-s-line"></i>'],
    responsive: {
      0: {
        items: 1 // 1 item on small screens
      },
      576: {
        items: 2 // 2 items on medium screens
      },
      992: {
        items: 3 // 3 items on large screens
      },
      1200: {
        items: 4 // 4 items on extra-large screens
      }
    },
    nav: true
  };

}
