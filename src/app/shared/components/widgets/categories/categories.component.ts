import { Component, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OwlOptions } from 'ngx-owl-carousel-o';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { Category, CategoryModel } from '../../../interface/category.interface';
import { CategoryState } from '../../../state/category.state';
import { AttributeService } from '../../../services/attribute.service';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent {

  @Select(CategoryState.category) category$: Observable<CategoryModel>;

  @Input() categoryIds: number[] = [];
  @Input() style: string = 'vertical';
  @Input() title?: string;
  @Input() image?: string;
  @Input() theme: string;
  @Input() sliderOption: OwlOptions;
  @Input() selectedCategoryId: number;
  @Input() bgImage: string;
  
  @Output() selectedCategory: EventEmitter<number> = new EventEmitter();

  public categories: Category[];
  public selectedCategorySlug: string[] = [];

  constructor(private route: ActivatedRoute,
    public attributeService: AttributeService,
    private router: Router) {
    this.route.queryParams.subscribe(params => {
      this.selectedCategorySlug = params['category'] ? params['category'].split(',') : [];
    });
    
    this.category$.subscribe(res => {
      this.categories = res.data;
      console.log(res)
    } );

  }

  ngOnChanges() {
    if(this.categoryIds && this.categoryIds.length) {
      this.category$.subscribe(res => {
        this.categories = res.data//.filter(category => this.categoryIds?.includes(category.id));
        console.log(res)
      });
    }
  }


  // Custom image mapping for categories in the Rome theme
  customCategoryImages: { [key: string]: string } = {
    'men': '../assets/images/cat-image-men.png',
    'activewear': '../assets/images/cat-image-sports.png',
    'sunglasses': '../assets/images/cat-image-sunglasses.png',
    'fashion': '../assets/images/cat-image-collection.png',
    'women': '../assets/images/cat-image-women.png',
  };

  // Custom background images for Paris theme categories
  customBackgroundImages: { [key: string]: string } = {
    'men': 'assets/images/category-main-men.png',
    'activewear': 'assets/images/category-main-active.jpg',
    'sunglasses': 'assets/images/cat-image-sunglasses.png',
    'fashion': 'assets/images/cat-image-collection.png',
    'women': 'assets/images/category-main.jpg',
  };

  // Method to get background image for Paris theme
  getBackgroundImage(slug: string): string {
    return this.customBackgroundImages[slug] || 'assets/images/shape.png';
  }

  // Custom name mapping for categories
  customCategoryNames: { [key: string]: string } = {
    'men': 'Men\'s Style',
    'activewear': 'Sport Style',
    'sunglasses': 'Eyewear',
    'fashion': 'Top Picks',
    'women': 'Women\'s Style',
  };

  // Method to get category name (custom or default)
  getCategoryName(slug: string, defaultName: string): string {
    return this.customCategoryNames[slug] || defaultName;
  }

  selectCategory(id?: number) {
    this.selectedCategory.emit(id);
  }

  redirectToCollection(slug: string) {
    let index = this.selectedCategorySlug.indexOf(slug);
    if(index === -1)
      this.selectedCategorySlug.push(slug);
    else
      this.selectedCategorySlug.splice(index,1);

    this.router.navigate(['/collections'], {
      relativeTo: this.route,
      queryParams: {
        category: this.selectedCategorySlug.length ? this.selectedCategorySlug?.join(',') : null
      },
      queryParamsHandling: 'merge', // preserve the existing query params in the route
      skipLocationChange: false  // do trigger navigation
    });
  }

  closeCanvasMenu() {
    this.attributeService.offCanvasMenu = false;
  }

}
