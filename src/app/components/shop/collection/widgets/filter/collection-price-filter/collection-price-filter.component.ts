import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Params } from '../../../../../../shared/interface/core.interface';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { SettingState } from '../../../../../../shared/state/setting.state';
import { Currency } from '../../../../../../shared/interface/currency.interface';

@Component({
  selector: 'app-collection-price-filter',
  templateUrl: './collection-price-filter.component.html',
  styleUrls: ['./collection-price-filter.component.scss']
})
export class CollectionPriceFilterComponent implements OnChanges {

  @Input() filter: Params;

  @Select(SettingState.selectedCurrency) selectedCurrency$: Observable<Currency>;

  public minPrice: number = 0;
  public maxPrice: number = 5000;
  public minValue: number = 0;
  public maxValue: number = 5000;
  public currencySymbol: string = '₹';

  constructor(private route: ActivatedRoute,
    private router: Router) {
    this.selectedCurrency$.subscribe(currency => {
      this.currencySymbol = currency?.symbol || '₹';
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['filter'] && this.filter?.['price']) {
      this.parsePriceFilter(this.filter['price']);
    } else {
      this.minPrice = this.minValue;
      this.maxPrice = this.maxValue;
    }
  }

  parsePriceFilter(priceParam: string) {
    if (!priceParam) {
      this.minPrice = this.minValue;
      this.maxPrice = this.maxValue;
      return;
    }

    // Handle comma-separated values (take the first range if multiple)
    const priceValues = priceParam.split(',');
    
    // Find the first range format (min-max)
    for (const priceValue of priceValues) {
      if (priceValue.includes('-')) {
        const [min, max] = priceValue.split('-').map(val => parseInt(val.trim()));
        if (!isNaN(min) && !isNaN(max)) {
          this.minPrice = Math.max(this.minValue, Math.min(min, this.maxValue));
          this.maxPrice = Math.min(this.maxValue, Math.max(max, this.minValue));
          return;
        }
      }
    }

    // If no range found, reset to defaults
    this.minPrice = this.minValue;
    this.maxPrice = this.maxValue;
  }

  onMinPriceChange(event: Event) {
    const value = (<HTMLInputElement>event?.target)?.value;
    this.minPrice = value ? Math.max(this.minValue, Math.min(parseFloat(value), this.maxPrice)) : this.minValue;
    this.validatePriceRange();
  }

  onMaxPriceChange(event: Event) {
    const value = (<HTMLInputElement>event?.target)?.value;
    this.maxPrice = value ? Math.min(this.maxValue, Math.max(parseFloat(value), this.minPrice)) : this.maxValue;
    this.validatePriceRange();
  }

  onMinSliderChange(event: Event) {
    const value = parseFloat((<HTMLInputElement>event?.target)?.value);
    this.minPrice = Math.min(value, this.maxPrice);
    this.applyFilter();
  }

  onMaxSliderChange(event: Event) {
    const value = parseFloat((<HTMLInputElement>event?.target)?.value);
    this.maxPrice = Math.max(value, this.minPrice);
    this.applyFilter();
  }

  validatePriceRange() {
    if (this.minPrice > this.maxPrice) {
      // Swap if min is greater than max
      const temp = this.minPrice;
      this.minPrice = this.maxPrice;
      this.maxPrice = temp;
    }
    // Ensure values are within bounds
    this.minPrice = Math.max(this.minValue, Math.min(this.minPrice, this.maxValue));
    this.maxPrice = Math.min(this.maxValue, Math.max(this.maxPrice, this.minValue));
  }

  applyFilter() {
    // Only apply if values are different from defaults
    let priceValue: string | null = null;

    if (this.minPrice !== this.minValue || this.maxPrice !== this.maxValue) {
      priceValue = `${Math.round(this.minPrice)}-${Math.round(this.maxPrice)}`;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        price: priceValue,
        page: 1
      },
      queryParamsHandling: 'merge',
      skipLocationChange: false
    });
  }

  clearFilter() {
    this.minPrice = this.minValue;
    this.maxPrice = this.maxValue;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        price: null,
        page: 1
      },
      queryParamsHandling: 'merge',
      skipLocationChange: false
    });
  }

  getSliderPercentage(value: number): number {
    return ((value - this.minValue) / (this.maxValue - this.minValue)) * 100;
  }

}
