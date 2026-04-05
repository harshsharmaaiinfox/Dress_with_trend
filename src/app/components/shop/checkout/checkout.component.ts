import { Component, ElementRef, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Store, Select } from '@ngxs/store';
import { FormBuilder, FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { Select2Data, Select2UpdateEvent } from 'ng-select2-component';
import { Router } from '@angular/router';
import { Observable, Subscription, map, of, debounceTime, distinctUntilChanged } from 'rxjs';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { AccountUser } from "../../../shared/interface/account.interface";
import { AccountState } from '../../../shared/state/account.state';
import { CartState } from '../../../shared/state/cart.state';
import { OrderState } from '../../../shared/state/order.state';
import { Checkout, PlaceOrder } from '../../../shared/action/order.action';
import { ClearCart } from '../../../shared/action/cart.action';
import { Register } from '../../../shared/action/auth.action';
import { AddressModalComponent } from '../../../shared/components/widgets/modal/address-modal/address-modal.component';
import { Cart } from '../../../shared/interface/cart.interface';
import { SettingState } from '../../../shared/state/setting.state';
import { GetSettingOption } from '../../../shared/action/setting.action';
import { OrderCheckout } from '../../../shared/interface/order.interface';
import { Values, DeliveryBlock } from '../../../shared/interface/setting.interface';
import { CartService } from '../../../shared/services/cart.service';
import { CountryState } from '../../../shared/state/country.state';
import { StateState } from '../../../shared/state/state.state';
import { AuthState } from '../../../shared/state/auth.state';
import { AuthService } from '../../../shared/services/auth.service';
import * as data from '../../../shared/data/country-code';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer } from '@angular/platform-browser';
import { interval } from 'rxjs';
import { delay, switchMap, takeWhile, tap } from 'rxjs/operators';
import { OrderService } from '../../../shared/services/order.service';
import { AccountService } from '../../../shared/services/account.service';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../../../shared/services/notification.service';
// import { PaymentInitModal } from 'pg-test-project';
// import * as React from 'react';

interface PaymentResponse {
  R: boolean;
  data: {
    payment_url?: string;
    action?: string;
    inputs?: { [key: string]: string };
  };
  msg?: string;
}

interface PaymentError {
  error?: {
    message: string;
  };
  message?: string;
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent {

  public breadcrumb: Breadcrumb = {
    title: "Checkout",
    items: [{ label: 'Checkout', active: true }]
  }

  @Select(AccountState.user) user$: Observable<AccountUser>;
  @Select(AuthState.accessToken) accessToken$: Observable<string>;
  @Select(CartState.cartItems) cartItem$: Observable<Cart[]>;
  @Select(CartState.cartTotal) cartTotal$: Observable<number>;
  @Select(OrderState.checkout) checkout$: Observable<OrderCheckout>;
  @Select(SettingState.setting) setting$: Observable<Values>;
  @Select(CartState.cartHasDigital) cartDigital$: Observable<boolean | number>;
  @Select(CountryState.countries) countries$: Observable<Select2Data>;

  @ViewChild("addressModal") AddressModal: AddressModalComponent;
  @ViewChild('cpn', { static: false }) cpnRef: ElementRef<HTMLInputElement>;
  @ViewChild("payByQRModal") payByQRModal: TemplateRef<any>;
  @ViewChild('checkoutForm') checkoutForm: any;

  public form: FormGroup;
  public coupon: boolean = true;
  public couponCode: string;
  public appliedCoupon: boolean = false;
  public couponError: string | null;
  public checkoutTotal: OrderCheckout;
  public loading: boolean = false;

  public shippingStates$: Observable<Select2Data>;
  public billingStates$: Observable<Select2Data>;
  public codes = data.countryCodes;

  public formData!: any;

  private pollingSubscription!: Subscription;
  private pollingInterval = 5000; // Poll every 5 seconds

  storeData: any;
  localUserCheck: any;

  payByNeoKredIntentSaveData: any;
  payByNeoStep = 0;
  payment_method = '';

  // Sub Paisa Config
  // @ViewChild('SubPaisaSdk', { static: true }) containerRef!: ElementRef;
  // formData = {
  //   env: 'stag',
  //   clientCode: 'LPS01',
  //   onToggle:() =>this.render(false) 
  // };
  // reactRoot: any = null;

  constructor(
    private store: Store, private router: Router,
    private formBuilder: FormBuilder, public cartService: CartService,
    private modalService: NgbModal,
    private sanitizer: DomSanitizer,
    private orderService: OrderService,
    private authService: AuthService,
    private accountService: AccountService,
    private notificationService: NotificationService,
    private cdRef: ChangeDetectorRef
  ) {
    this.store.dispatch(new GetSettingOption());

    this.form = this.formBuilder.group({
      products: this.formBuilder.array([], [Validators.required]),
      shipping_address_id: new FormControl('', [Validators.required]),
      billing_address_id: new FormControl('', [Validators.required]),
      points_amount: new FormControl(false),
      wallet_balance: new FormControl(false),
      coupon: new FormControl(),
      delivery_description: new FormControl('', [Validators.required]),
      delivery_interval: new FormControl(),
      payment_method: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      country_code: new FormControl('91', [Validators.required]),
      phone: new FormControl('', [Validators.required]),
      password: new FormControl(),
      password_confirmation: new FormControl(),
      shipping_address: new FormGroup({
        title: new FormControl('', [Validators.required]),
        street: new FormControl('', [Validators.required]),
        city: new FormControl('', [Validators.required]),
        area: new FormControl('', [Validators.required]),
        phone: new FormControl('', [Validators.required]),
        pincode: new FormControl('', [Validators.required]),
        country_code: new FormControl('91', [Validators.required]),
        country_id: new FormControl('', [Validators.required]),
        state_id: new FormControl('', [Validators.required]),
      }),
      billing_address: new FormGroup({
        same_shipping: new FormControl(false),
        title: new FormControl('', [Validators.required]),
        street: new FormControl('', [Validators.required]),
        city: new FormControl('', [Validators.required]),
        area: new FormControl('', [Validators.required]),
        phone: new FormControl('', [Validators.required]),
        pincode: new FormControl('', [Validators.required]),
        country_code: new FormControl('91', [Validators.required]),
        country_id: new FormControl('', [Validators.required]),
        state_id: new FormControl('', [Validators.required]),
      })
    });

    const setting = this.store.selectSnapshot(state => state.setting);
    if (setting?.setting?.activation) {
      setting.setting.activation.guest_checkout = true;
    }

    if (this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      this.downloadPINAreaExcelJSON();
      this.form.removeControl('name');
      this.form.removeControl('email');
      this.form.removeControl('country_code');
      this.form.removeControl('phone');
      this.form.removeControl('password');
      this.form.removeControl('password_confirmation');
      this.form.removeControl('shipping_address');
      this.form.removeControl('billing_address');

    } else {

      if (this.store.selectSnapshot(state => state.setting).setting.activation.guest_checkout) {
        this.form.removeControl('shipping_address_id');
        this.form.removeControl('billing_address_id');
        this.form.removeControl('points_amount');
        this.form.removeControl('wallet_balance');
      }

    }

    this.cartDigital$.subscribe(value => {
      if (value == 1) {
        if (this.form.controls['shipping_address_id']) {
          this.form.controls['shipping_address_id'].clearValidators();
          this.form.controls['shipping_address_id'].updateValueAndValidity();
        }
        if (this.form.controls['delivery_description']) {
          this.form.controls['delivery_description'].clearValidators();
          this.form.controls['delivery_description'].updateValueAndValidity();
        }
      } else {
        if (this.form.controls['shipping_address_id']) {
          this.form.controls['shipping_address_id'].setValidators([Validators.required]);
          this.form.controls['shipping_address_id'].updateValueAndValidity();
        }
        if (this.form.controls['delivery_description']) {
          this.form.controls['delivery_description'].setValidators([Validators.required]);
          this.form.controls['delivery_description'].updateValueAndValidity();
        }
      }
    });

    this.form.get('billing_address.same_shipping')?.valueChanges.subscribe(value => {
      if (value) {
        this.form.get('billing_address.title')?.setValue(this.form.get('shipping_address.title')?.value);
        this.form.get('billing_address.street')?.setValue(this.form.get('shipping_address.street')?.value);
        this.form.get('billing_address.country_id')?.setValue(this.form.get('shipping_address.country_id')?.value);
        this.form.get('billing_address.state_id')?.setValue(this.form.get('shipping_address.state_id')?.value);
        this.form.get('billing_address.city')?.setValue(this.form.get('shipping_address.city')?.value);
        this.form.get('billing_address.area')?.setValue(this.form.get('shipping_address.area')?.value);
        this.form.get('billing_address.pincode')?.setValue(this.form.get('shipping_address.pincode')?.value);
        this.form.get('billing_address.country_code')?.setValue(this.form.get('shipping_address.country_code')?.value);
        this.form.get('billing_address.phone')?.setValue(this.form.get('shipping_address.phone')?.value);
      } else {
        this.form.get('billing_address.title')?.setValue('');
        this.form.get('billing_address.street')?.setValue('');
        this.form.get('billing_address.country_id')?.setValue('');
        this.form.get('billing_address.state_id')?.setValue('');
        this.form.get('billing_address.city')?.setValue('');
        this.form.get('billing_address.area')?.setValue('');
        this.form.get('billing_address.pincode')?.setValue('');
        this.form.get('billing_address.country_code')?.setValue('');
        this.form.get('billing_address.phone')?.setValue('');
      }
    });

    this.cartService.getUpdateQtyClickEvent().subscribe(() => {
      this.products();
      this.checkout();
    });

    this.form.controls['phone']?.valueChanges.subscribe((value) => {
      if (value && value.toString().length > 10) {
        this.form.controls['phone']?.setValue(+value.toString().slice(0, 10));
      }
    });

    this.form.get('shipping_address.phone')?.valueChanges.subscribe((value) => {
      if (value && value.toString().length > 10) {
        this.form.get('shipping_address.phone')?.setValue(+value.toString().slice(0, 10));
      }
    });

    this.form.get('billing_address.phone')?.valueChanges.subscribe((value) => {
      if (value && value.toString().length > 10) {
        this.form.get('billing_address.phone')?.setValue(+value.toString().slice(0, 10));
      }
    });

    this.localUserCheck = JSON.parse(localStorage.getItem('account') || '{}');

    // Remove automatic PIN code data fetching on page load
    // this.downloadPINAreaExcelJSON();

    this.form.get('shipping_address.pincode')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe((value) => {
        this.handlePincodeChange(value, 'shipping_address');
      });

    this.form.get('billing_address.pincode')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe((value) => {
        this.handlePincodeChange(value, 'billing_address');
      });
  }

  public pinCodeAreaOfficeCircleDataJSON: any;
  public stateNameData: any;
  public cityOptions: any[] = [];
  public officeNameData: any[] = [];
  public billingCityOptions: any[] = [];
  public billingOfficeNameData: any[] = [];
  public checkIfPinCodeExists = true;

  downloadPINAreaExcelJSON() {
    this.authService.fetchAreaPINCodeJSON().subscribe({
      next: (res: any) => {
        if (res && res.success !== false) {
          this.pinCodeAreaOfficeCircleDataJSON = res['data'] || res;
          this.stateNameData = [...new Map(this.pinCodeAreaOfficeCircleDataJSON.map((item: any) => [item.StateName, item])).values()];
        }
      }
    });
  }

  handlePincodeChange(value: any, formGroupName: string) {
    if (value && value.toString().length > 5) {
      if (!this.pinCodeAreaOfficeCircleDataJSON) {
        this.authService.fetchAreaPINCodeJSON().subscribe({
          next: (res) => {
            if (res) {
              this.pinCodeAreaOfficeCircleDataJSON = res['data'];
              this.stateNameData = [...new Map(this.pinCodeAreaOfficeCircleDataJSON.map((item: any) => [item.StateName, item])).values()];
              this.handlePincodeChange(value, formGroupName);
            }
          }
        });
        return;
      }

      const filterPinCodeAreas = this.pinCodeAreaOfficeCircleDataJSON.filter((dataz: any) => dataz.Pincode == value);
      if (filterPinCodeAreas.length) {
        const stateName = filterPinCodeAreas[0].StateName;
        const districtName = filterPinCodeAreas[0].District;

        // Find state ID by name
        this.store.selectSnapshot(StateState.state).data.forEach((st: any) => {
          if (st.name.toLowerCase() === stateName.toLowerCase()) {
            this.form.get(`${formGroupName}.state_id`)?.setValue(String(st.id));
            this.form.get(`${formGroupName}.country_id`)?.setValue(String(st.country_id));
          }
        });

        const filteredDistricts = this.pinCodeAreaOfficeCircleDataJSON
          .filter((item: any) => item.StateName === stateName)
          .map((item: any) => ({
            label: item.District,
            value: item.District,
          }))
          .filter((value: any, index: number, self: any) =>
            self.findIndex((v: any) => v.label === value.label) === index
          );

        if (formGroupName === 'shipping_address') {
          this.cityOptions = filteredDistricts;
        } else {
          this.billingCityOptions = filteredDistricts;
        }

        const offices = this.pinCodeAreaOfficeCircleDataJSON
          .filter((dataz: any) => dataz.District?.toLowerCase() == districtName.toLowerCase())
          .map((dataz: any) => ({
            label: dataz.OfficeName,
            value: dataz.OfficeName,
            Pincode: dataz.Pincode
          }));

        if (formGroupName === 'shipping_address') {
          this.officeNameData = offices;
        } else {
          this.billingOfficeNameData = offices;
        }

        this.form.get(`${formGroupName}.city`)?.setValue(districtName);
        this.form.get(`${formGroupName}.area`)?.setValue(filterPinCodeAreas[0].OfficeName);

        this.checkout();
      }
    }
  }

  shippingStateChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      const selectedStateObj = this.store.selectSnapshot(StateState.state).data.find((st: any) => st.id == data.value);
      if (selectedStateObj) {
        const filteredDistricts = this.pinCodeAreaOfficeCircleDataJSON
          .filter((item: any) => item.StateName.toLowerCase() === selectedStateObj.name.toLowerCase())
          .map((item: any) => ({
            label: item.District,
            value: item.District,
          }))
          .filter((value: any, index: number, self: any) =>
            self.findIndex((v: any) => v.label === value.label) === index
          );
        this.cityOptions = filteredDistricts;
      }
    }
  }

  billingStateChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      const selectedStateObj = this.store.selectSnapshot(StateState.state).data.find((st: any) => st.id == data.value);
      if (selectedStateObj) {
        const filteredDistricts = this.pinCodeAreaOfficeCircleDataJSON
          .filter((item: any) => item.StateName.toLowerCase() === selectedStateObj.name.toLowerCase())
          .map((item: any) => ({
            label: item.District,
            value: item.District,
          }))
          .filter((value: any, index: number, self: any) =>
            self.findIndex((v: any) => v.label === value.label) === index
          );
        this.billingCityOptions = filteredDistricts;
      }
    }
  }

  shippingCityChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      const offices = this.pinCodeAreaOfficeCircleDataJSON
        .filter((dataz: any) => dataz.District?.toLowerCase() == data.value?.toString().toLowerCase())
        .map((dataz: any) => ({
          label: dataz.OfficeName,
          value: dataz.OfficeName,
          Pincode: dataz.Pincode
        }));
      this.officeNameData = offices;
    }
  }

  billingCityChangeForDropDown(data: Select2UpdateEvent) {
    if (data && data?.value) {
      const offices = this.pinCodeAreaOfficeCircleDataJSON
        .filter((dataz: any) => dataz.District?.toLowerCase() == data.value?.toString().toLowerCase())
        .map((dataz: any) => ({
          label: dataz.OfficeName,
          value: dataz.OfficeName,
          Pincode: dataz.Pincode
        }));
      this.billingOfficeNameData = offices;
    }
  }

  shippingAreaChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      const office = this.officeNameData.find(o => o.value == data.value);
      if (office) {
        this.form.get('shipping_address.pincode')?.setValue(office.Pincode, { emitEvent: false });
      }
      this.checkout();
    }
  }

  billingAreaChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      const office = this.billingOfficeNameData.find(o => o.value == data.value);
      if (office) {
        this.form.get('billing_address.pincode')?.setValue(office.Pincode, { emitEvent: false });
      }
      this.checkout();
    }
  }


  get productControl(): FormArray {
    return this.form.get('products') as FormArray;
  }

  // Name validation methods
  onNameInput(event: any) {
    const input = event.target;
    const value = input.value;
    // Remove any numbers and special characters except letters, spaces, hyphens, apostrophes, and periods
    const cleanValue = value.replace(/[^a-zA-Z\s\-'\.]/g, '');
    if (value !== cleanValue) {
      input.value = cleanValue;
      // Update the corresponding form control
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form.get(formControlName)?.setValue(cleanValue);
      }
    }
  }

  onNameKeyPress(event: KeyboardEvent) {
    const char = String.fromCharCode(event.which);
    // Allow letters, spaces, hyphens, apostrophes, periods, and navigation keys
    const allowedChars = /[a-zA-Z\s\-'\.]/;
    const isAllowed = allowedChars.test(char) ||
      event.key === 'Backspace' ||
      event.key === 'Delete' ||
      event.key === 'Tab' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'Home' ||
      event.key === 'End';

    if (!isAllowed) {
      event.preventDefault();
    }
  }

  // private render(isOpen: boolean){
  //   this.reactRoot.render(
  //     React.createElement(PaymentInitModal, { ...this.formData as any, isOpen })
  //   )
  // }

  ngOnInit() {
    this.checkout$.subscribe(data => this.checkoutTotal = data);
    this.products();
  }

  products() {
    this.cartItem$.subscribe(items => {
      this.productControl.clear();
      items.forEach((item: Cart) =>
        this.productControl.push(
          this.formBuilder.group({
            product_id: new FormControl(item?.product_id, [Validators.required]),
            variation_id: new FormControl(item?.variation_id ? item?.variation_id : ''),
            quantity: new FormControl(item?.quantity),
          })
        ));
    });
  }

  selectShippingAddress(id: number) {
    if (id) {
      this.form.controls['shipping_address_id'].setValue(Number(id));
      this.checkout();
    }
  }

  selectBillingAddress(id: number) {
    if (id) {
      this.form.controls['billing_address_id'].setValue(Number(id));
      this.checkout();
    }
  }

  selectDelivery(value: DeliveryBlock) {
    this.form.controls['delivery_description'].setValue(value?.delivery_description);
    this.form.controls['delivery_interval'].setValue(value?.delivery_interval);
    this.checkout();
  }

  selectPaymentMethod(value: string) {
    this.form.controls['payment_method'].setValue(value);
    this.payment_method = value;
    this.cdRef.detectChanges();

    // Trigger checkout calculation
    this.checkout(value);
  }

  initiateSubPaisa(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const payload = {
      uuid,
      ...JSON.parse(userData || '{}')?.user,
      checkout: this.storeData?.order?.checkout
    }
    this.cartService.initiateSubPaisa(
      {
        uuid: payload.uuid,
        email: payload.email,
        total: this.storeData?.order?.checkout?.total?.total,
        phone: JSON.parse(userData || '{}')?.user?.phone,
        name: JSON.parse(userData || '{}')?.user?.name,
        address: JSON.parse(userData || '{}')?.user?.address?.[0]?.city + ' ' + JSON.parse(userData || '{}')?.user?.address?.[0]?.area
      }
    ).subscribe({
      next: (data: any) => {
        if (data) {
          // Store payment info in session storage
          sessionStorage.setItem('payment_uuid', uuid);
          sessionStorage.setItem('payment_method', payment_method);
          sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
          localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

          // Create a temporary form and submit it
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = data.data.action || data.data;
          form.target = '_self';

          // Add any required form fields from data.data
          if (data.data.inputs) {
            Object.keys(data.data.inputs).forEach(key => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = data.data.inputs[key];
              form.appendChild(input);
            });
          }

          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
        }
      },
      error: (err: any) => {
        console.log(err);
      }
    });
  }

  startPollingForPaymentStatus(uuid: any, action: any, paymentWindow: Window | null, payment_method: string) {
    if (!paymentWindow) return;

    let windowClosedManually = false;

    // ✅ Start monitoring the payment window's URL and check if it's closed
    const urlCheckInterval = setInterval(() => {
      try {
        if (paymentWindow.closed) {
          console.log("Payment window closed manually or due to an issue.");
          clearInterval(urlCheckInterval);
          windowClosedManually = true;

          // ✅ If closed manually, inform the frontend
          this.handlePaymentSuccess({ status: false, reason: "Window closed manually" }, action, uuid, payment_method);
          return;
        }

        const currentUrl = paymentWindow.location.href;
        console.log("Current Payment Window URL:", currentUrl);

        // ✅ Check if redirected to success or failure page
        if (currentUrl.includes("success") || currentUrl.includes("failure")) {
          console.log("Redirect detected, closing window.");
          clearInterval(urlCheckInterval);
          paymentWindow.close();

          // ✅ Process the response
          this.handlePaymentSuccess({ status: true, url: currentUrl }, action, uuid, payment_method);
        }
      } catch (error) {
        // Catches CORS-related issues if the domain changes
        console.warn("Unable to access payment window URL (possible CORS issue).");
      }
    }, 1000); // Check every second

    // ✅ Continue polling for payment status
    this.pollingSubscription = interval(this.pollingInterval)
      .pipe(
        switchMap(() => this.cartService.checkPaymentResponse(uuid, payment_method)),
        map(response => ({
          ...response,
          status: response.status || false
        })),
        delay(9999999999999), // Wait before forcing status update
        map(response => ({
          ...response,
          status: true // Force status to true after 60s if still false
        })),
        takeWhile((response: { status: boolean }) => !response.status, true)
      )
      .subscribe({
        next: (response: any) => {
          console.log('Payment Status:', response);

          if (response.status) {
            this.pollingSubscription.unsubscribe(); // Stop polling

            // ✅ Close the popup window if still open
            if (paymentWindow && !paymentWindow.closed) {
              paymentWindow.close();
              console.log("Payment popup closed automatically.");
            }

            this.handlePaymentSuccess(response, action, uuid, 'sub_paisa');
          }
        },
        error: (err: any) => {
          console.error('Error checking payment status:', err);
        },
        complete: () => {
          if (windowClosedManually) {
            console.log("Polling stopped: Payment window was closed manually.");
          }
        }
      });
  }

  handlePaymentSuccess(response: any, action: any, uuid: any, payment_method: string) {
    console.log('Payment was successful:', response);
    console.log('Call /order here now', action);
    this.store.dispatch(new PlaceOrder(Object.assign({}, action, { uuid: uuid, payment_method })));
  }

  async checkPaymentResponse(uuid: any, payment_method: string) {
    this.cartService.checkPaymentResponse(uuid, payment_method).subscribe({
      next: (data: any) => {
        console.log(data);
        if (data.R === true || data.R === false) {
          console.log('Redirect to Success or Fail');
          this.router.navigate(['order/checkout-success'], { queryParams: { order_status: data.R } });
        } else {
          console.log('Payment in Pending State');
        }
      },
      error: (err: any) => {
        console.log(err);
      }
    });
  }

  async redirectToPayURL() {
    this.cartService.redirectToPayUrl().subscribe({
      next: (data: any) => {
        console.log(data);
        if (data && data.url) {
          window.open(data.url, '_blank');
        }
      },
      error: (err: any) => {
        console.log(err);
      }
    });
  }

  // NeoKred

  initiateNeoKredPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateNeoKredIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: any) => {
        if (response?.R && response?.data) {
          try {
            const neoKredData = response.data;

            if (neoKredData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

              // Use window.location.href for Safari compatibility
              window.location.href = neoKredData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing NeoKred response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: any) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  checkTransectionStatusNeoKred() { // https://apidocument-cb.netlify.app/#transaction-status
    this.payByNeoStep = 1;
    this.loading = true;
    this.pollingSubscription = interval(this.pollingInterval)
      .pipe(
        switchMap(() => this.cartService.checkTransectionStatusNeoKred(
          {
            uuid: 'payload.uuid',
            email: 'payload.email',
            transactionId: "NKFV2ie9NpNUGTa5cETbpBDNoKM"
          })
        ),
        map((response: any) => ({
          ...response,
          status: response.status || false
        })),
        delay(9999999999999), // Wait before forcing status update
        map(response => ({
          ...response,
          status: true // Force status to true after 60s if still false
        })),
        takeWhile((response: { status: boolean }) => !response.status, true)
      )
      .subscribe({
        next: (response: any) => {
          console.log('Payment Status:', response);

          if (response.status) {
            this.loading = false;
            this.pollingSubscription.unsubscribe(); // Stop polling

            // this.handlePaymentSuccess(response, action, uuid);
          }
        },
        error: (err: any) => {
          console.error('Error checking payment status:', err);
        },
        complete: () => {
          //
        }
      });
  }

  // CashFree Payment Integration
  initiateCashFreePaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateCashFreeIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: any) => {
        if (response?.R && response?.data) {
          try {
            const cashFreeData = response.data;

            if (cashFreeData?.payment_link) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

              // Use window.location.href for Safari compatibility
              window.location.href = cashFreeData.payment_link;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing CashFree response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: any) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  checkTransactionStatusCashFree(uuid: any, payment_method: string) {
    this.cartService.checkTransectionStatusCashFree(uuid, payment_method).subscribe({
      next: (data: any) => {
        console.log(data);
        if (data.R === true || data.R === false) {
          console.log('Redirect to Success or Fail');
          this.router.navigate(['order/checkout-success'], { queryParams: { order_status: data.R } });
        } else {
          console.log('Payment in Pending State');
        }
      },
      error: (err: any) => {
        console.log(err);
      }
    });
  }

  // Fashion with Trends NeoKred Payment Integration
  initiateFashionWithTrendsNeoCredIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateFashionWithTrendsNeoCredIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: any) => {
        if (response?.R && response?.data) {
          try {
            const zyaadaPayData = response.data;

            if (zyaadaPayData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Open in current tab
              window.location.href = zyaadaPayData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
              this.notificationService.showError(zyaadaPayData.message);
            }
          } catch (error) {
            console.error("Error parsing Zyaada Pay response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: any) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  async openNeoKredModal(data: any) {
    this.payByNeoKredIntentSaveData = data;
    console.log(this.payByNeoKredIntentSaveData);
    this.modalService.open(this.payByQRModal, {
      ariaLabelledBy: 'address-add-Modal',
      centered: true,
      windowClass: 'theme-modal modal-lg address-modal'
    }).result.then((result) => {
      `Result ${result}`
      const formDataContainer = document.getElementById('formDataContainer');
      console.log(formDataContainer);
    }, (reason) => {
      const formDataContainer = document.getElementById('formDataContainer');
      console.log(formDataContainer);
    });
  }

  payByNeoKredIntentSaveDataUpiIntentString(upi: string) {
    switch (upi) {
      case 'gpay_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "tez://pay?");
      case 'phone_pay_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "phonepe://pay?");
      case 'paytm_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "paytmmp://pay?");
      case 'bhim_upi':
        break;
      // return this.payByNeoKredIntentSaveData.upiIntentString.replace()
      default:
        break;
    }

  }

  paybyNeoNext() {
    this.payByNeoStep = 1;
  }

  paybyNeoDone() {
    this.payByNeoStep = 0;
    this.modalService.dismissAll();
    this.pollingSubscription.unsubscribe();
  }


  togglePoint(event: Event) {
    this.form.controls['points_amount'].setValue((<HTMLInputElement>event.target)?.checked);
    this.checkout();
  }

  toggleWallet(event: Event) {
    this.form.controls['wallet_balance'].setValue((<HTMLInputElement>event.target)?.checked);
    this.checkout();
  }

  showCoupon() {
    this.coupon = true;
  }

  setCoupon(value?: string) {
    this.couponError = null;

    if (value)
      this.form.controls['coupon'].setValue(value);
    else
      this.form.controls['coupon'].reset();

    this.store.dispatch(new Checkout(this.form.value)).subscribe({
      error: (err: any) => {
        this.couponError = err.message;
      },
      complete: () => {
        this.appliedCoupon = value ? true : false;
        this.couponError = null;
      }
    });
  }

  couponRemove() {
    this.setCoupon();
  }

  shippingCountryChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      this.shippingStates$ = this.store
        .select(StateState.states)
        .pipe(map(filterFn => filterFn(+data?.value)));
    } else {
      this.form.get('shipping_address.state_id')?.setValue('');
      this.shippingStates$ = of();
    }
  }

  billingCountryChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      this.billingStates$ = this.store
        .select(StateState.states)
        .pipe(map(filterFn => filterFn(+data?.value)));
      if (this.form.get('billing_address.same_shipping')?.value) {
        setTimeout(() => {
          this.form.get('billing_address.state_id')?.setValue(this.form.get('shipping_address.state_id')?.value);
        }, 200);
      }
    } else {
      this.form.get('billing_address.state_id')?.setValue('');
      this.billingStates$ = of();
    }
  }

  checkout(payment_method?: string) {
    // If has coupon error while checkout
    if (this.couponError) {
      this.couponError = null;
      this.cpnRef.nativeElement.value = '';
      this.form.controls['coupon'].reset();
    }

    const token = this.store.selectSnapshot(state => state.auth && state.auth.access_token);
    const shippingAddressId = this.form.get('shipping_address_id')?.value;
    const billingAddressId = this.form.get('billing_address_id')?.value;

    if (token && !this.form.get('shipping_address_id')) {
      this.form.addControl('shipping_address_id', new FormControl('', [Validators.required]));
      if (billingAddressId) {
        this.form.get('shipping_address_id')?.setValue(billingAddressId);
      }
    }

    // Force billing_address_id in form if token exists
    if (token && !this.form.get('billing_address_id')) {
      this.form.addControl('billing_address_id', new FormControl('', [Validators.required]));
      if (shippingAddressId || this.form.get('shipping_address_id')?.value) {
        this.form.get('billing_address_id')?.setValue(shippingAddressId || this.form.get('shipping_address_id')?.value);
      }
    }

    // Automatically set billing_address_id if missing but shipping_address_id exists (for logged in users)
    if (token && this.form.get('shipping_address_id')?.value && !this.form.get('billing_address_id')?.value) {
      if (!this.form.get('billing_address_id')) {
        this.form.addControl('billing_address_id', new FormControl(this.form.get('shipping_address_id')?.value, [Validators.required]));
      } else {
        this.form.get('billing_address_id')?.setValue(this.form.get('shipping_address_id')?.value);
      }
    }

    const hasAddressId = this.form.get('shipping_address_id')?.value;
    const isGuestAddressValid = this.form.get('shipping_address')?.valid;

    if (this.form.controls['products'].valid && (!token || hasAddressId || isGuestAddressValid || this.form.get('shipping_address')?.value)) {
      this.loading = true;
      this.cdRef.detectChanges();
      this.store.dispatch(new Checkout(this.form.value)).subscribe({
        next: (value: any) => {
          this.storeData = value;
          this.cdRef.detectChanges();
        },
        error: (err: any) => {
          this.loading = false;
          this.cdRef.detectChanges();
          // throw new Error(err);
        },
        complete: () => {
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });
    }
  }

  registerUser() {
    this.form.markAllAsTouched();
    if (this.form.controls['name'].valid &&
      this.form.controls['email'].valid &&
      this.form.controls['phone'].valid &&
      this.form.controls['password'].value) {
      this.loading = true;
      const payload = {
        name: this.form.get('name')?.value,
        email: this.form.get('email')?.value,
        phone: this.form.get('phone')?.value,
        country_code: this.form.get('country_code')?.value,
        password: this.form.get('password')?.value,
        password_confirmation: this.form.get('password')?.value,
      };

      this.store.dispatch(new Register(payload)).subscribe({
        next: () => {
          this.loading = false;
          this.notificationService.showSuccess('Registered successfully!');
          this.downloadPINAreaExcelJSON();

          // Save the address to account first
          const addressPayload = this.form.get('shipping_address')?.getRawValue();

          // Since we are now authenticated, let's remove guest fields which might be invalid
          // and block `this.form.valid` for Place Order
          this.form.removeControl('name');
          this.form.removeControl('email');
          this.form.removeControl('country_code');
          this.form.removeControl('phone');
          this.form.removeControl('password');
          this.form.removeControl('password_confirmation');
          this.form.removeControl('shipping_address');
          this.form.removeControl('billing_address');

          if (addressPayload) {
            this.accountService.createAddress(addressPayload).subscribe({
              next: (createdAddress: any) => {
                const addressId = createdAddress?.id || createdAddress?.data?.id;
                if (addressId) {
                  // Add or update the IDs
                  if (!this.form.get('shipping_address_id')) {
                    this.form.addControl('shipping_address_id', new FormControl(addressId, [Validators.required]));
                  } else {
                    this.form.get('shipping_address_id')?.setValue(addressId);
                  }

                  if (!this.form.get('billing_address_id')) {
                    this.form.addControl('billing_address_id', new FormControl(addressId, [Validators.required]));
                  } else {
                    this.form.get('billing_address_id')?.setValue(addressId);
                  }
                }

                // Double check both IDs are set for authenticated user
                if (!this.form.get('billing_address_id')?.value && this.form.get('shipping_address_id')?.value) {
                  this.form.get('billing_address_id')?.setValue(this.form.get('shipping_address_id')?.value);
                }

                this.checkout();
                this.cdRef.detectChanges();
              },
              error: () => {
                this.checkout(); // Fallback if address save fails
                this.cdRef.detectChanges();
              }
            });
          } else {
            this.checkout();
            this.cdRef.detectChanges();
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.notificationService.showError(err);
          this.cdRef.detectChanges();
        }
      });
    } else {
      this.notificationService.showError('Please fill all account details correctly.');
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/checkout' } });
  }

  placeorder() {
    if (this.form.valid) {
      if (this.cpnRef && !this.cpnRef.nativeElement.value) {
        this.form.controls['coupon'].reset();
      }

      const uuid = uuidv4();

      const formData = {
        ...this.form.value,
        uuid: uuid
      }

      let action = new PlaceOrder(formData);

      this.orderService.placeOrder(action?.payload).pipe(
        tap({
          next: result => {
            console.log(result);
          },
          error: err => {
            throw new Error(err?.error?.message);
          }
        })
      ).subscribe({
        next: (result) => {
          if (this.payment_method === 'cashfree_sleeksynergy') {
            this.initiateSleekSynergyPaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'sleeksynergy_starpaisa') {
            this.initiateSleekSynergyStarPaisaPaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'cash_free') {
            this.initiateCashFreePaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'sub_paisa') {
            this.initiateSubPaisa(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'neoKred') {
            this.initiateNeoKredPaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'zyaada_pay') {
            this.initiateZyaadaPayPaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'ease_buzz') {
            this.initiateEaseBuzzPaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'neoKred2') {
            this.initiateNeoKred2PaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'gaonvashi_cashfree') {
            this.initiateGaonvashiCashFreePaymentIntent(this.payment_method, uuid, result);
          }
          if (this.payment_method === 'sleek_nabu') {
            this.initiateSleekNabuPaymentIntent(this.payment_method, uuid, result);
          }
        },
        error: (err: any) => {
          console.log(err);
          this.loading = false;
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        control?.markAsTouched();
      });
    }
  }

  // Sleek Synergy Payment Integration
  initiateSleekSynergyPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateSleekSynergyIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (resp: any) => {
        // Avoid duplicate polling
        this.pollingSubscription && this.pollingSubscription.unsubscribe();

        let attemptedNavigation = false;
        let paymentWindow: Window | null = null;

        // Common response shapes support
        const paymentLink = resp?.payment_link || resp?.url || resp?.data?.payment_url || resp?.data?.payment_link;

        if (paymentLink) {
          // Save session info
          sessionStorage.setItem('payment_uuid', uuid);
          sessionStorage.setItem('payment_method', payment_method);
          sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
          localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

          // Prefer same-tab redirect to avoid popup blockers
          attemptedNavigation = true;
          window.location.href = paymentLink;
        } else if (typeof resp?.data === 'string') {
          const container = document.getElementById('paymentContainer');
          if (container) {
            container.innerHTML = resp.data;
            setTimeout(() => {
              paymentWindow = window.open('', 'PaymentWindow', 'width=600,height=700,resizable=yes,scrollbars=yes');
              if (paymentWindow) {
                const formHtml = (container.querySelector('form') as HTMLFormElement)?.outerHTML || '';
                paymentWindow.document.write(`<html><body>${formHtml}<script>document.getElementById('submitButton')&&document.getElementById('submitButton').click();<\/script></body></html>`);
                paymentWindow.document.close();
                attemptedNavigation = true;
              }
            }, 500);
          }
        }

        // Start polling only if we attempted to navigate to payment
        if (attemptedNavigation) {
          this.checkTransactionStatusSleekSynergy(uuid, paymentWindow, payment_method);
        }
      },
      error: (err: any) => {
        console.error(err);
      }
    });
  }

  initiateSleekSynergyStarPaisaPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateSleekSynergyStarPaisaIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (resp: any) => {
        this.pollingSubscription && this.pollingSubscription.unsubscribe();

        let attemptedNavigation = false;
        let paymentWindow: Window | null = null;

        const paymentLink = resp?.payment_link || resp?.url || resp?.data?.payment_url || resp?.data?.payment_link;

        if (paymentLink) {
          sessionStorage.setItem('payment_uuid', uuid);
          sessionStorage.setItem('payment_method', payment_method);
          sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
          localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

          attemptedNavigation = true;
          window.location.href = paymentLink;
        } else if (typeof resp?.data === 'string') {
          const container = document.getElementById('paymentContainer');
          if (container) {
            container.innerHTML = resp.data;
            setTimeout(() => {
              paymentWindow = window.open('', 'PaymentWindow', 'width=600,height=700,resizable=yes,scrollbars=yes');
              if (paymentWindow) {
                const formHtml = (container.querySelector('form') as HTMLFormElement)?.outerHTML || '';
                paymentWindow.document.write(`<html><body>${formHtml}<script>document.getElementById('submitButton')&&document.getElementById('submitButton').click();<\/script></body></html>`);
                paymentWindow.document.close();
                attemptedNavigation = true;
              }
            }, 500);
          }
        }

        if (attemptedNavigation) {
          this.checkTransactionStatusSleekSynergy(uuid, paymentWindow, payment_method);
        }
      },
      error: (err: any) => {
        console.error(err);
      }
    });
  }

  checkTransactionStatusSleekSynergy(uuid: string, paymentWindow: Window | null, payment_method: string = 'cashfree_sleeksynergy') {
    const poll$ = interval(5000).pipe(
      switchMap(() => this.cartService.checkTransactionStatusSleekSynergy(uuid, payment_method)),
      takeWhile((res: any) => !res?.status, true)
    );

    this.pollingSubscription = poll$.subscribe({
      next: (res: any) => {
        if (res?.status) {
          if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
          const action = new PlaceOrder(this.form.value);
          this.store.dispatch(new PlaceOrder(Object.assign({}, action.payload, { uuid, payment_method })));
        }
      },
      error: (err) => console.error(err)
    });
  }

  paybyqr() {
    this.modalService.dismissAll();
    // PlaceOrder Here
  }

  clearCart() {
    this.store.dispatch(new ClearCart());
  }

  ngOnDestroy() {
    this.loading = false;
    this.form.reset();
    this.pollingSubscription && this.pollingSubscription.unsubscribe();
  }

  // Zyaada Pay Payment Integration
  initiateZyaadaPayPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateZyaadaPayIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: any) => {
        if (response?.R && response?.data) {
          try {
            const zyaadaPayData = response.data;

            if (zyaadaPayData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

              // Use window.location.href for Safari compatibility
              window.location.href = zyaadaPayData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Zyaada Pay response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: any) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // Gaonvashi CashFree Payment Integration
  initiateGaonvashiCashFreePaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateGaonvashiCashFreePaymentIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: any) => {
        if (response?.R && response?.data) {
          try {
            const cashFreeData = response.data;

            if (cashFreeData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

              // Use window.location.href for Safari compatibility
              window.location.href = cashFreeData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Gaonvashi CashFree response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: any) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // EaseBuzz Payment Integration
  initiateEaseBuzzPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    // Use initiateCashFreeIntent as a fallback since EaseBuzz is not implemented
    this.cartService.initiateCashFreeIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: PaymentResponse) => {
        if (response?.R && response?.data) {
          try {
            const easeBuzzData = response.data;

            if (easeBuzzData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

              // Use window.location.href for Safari compatibility
              window.location.href = easeBuzzData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing EaseBuzz response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: PaymentError) => {
        console.log("Error initiating payment:", err?.error?.message || err?.message);
      }
    });
  }

  // NeoKred2 Payment Integration
  initiateNeoKred2PaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    // Use initiateNeoKredIntent since NeoKred2 is not implemented
    this.cartService.initiateNeoKredIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: PaymentResponse) => {
        if (response?.R && response?.data) {
          try {
            const neoKredData = response.data;

            if (neoKredData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

              // Use window.location.href for Safari compatibility
              window.location.href = neoKredData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing NeoKred2 response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: PaymentError) => {
        console.log("Error initiating payment:", err?.error?.message || err?.message);
      }
    });
  }

  // Sleek Nabu Payment Integration
  initiateSleekNabuPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateSleekNabuIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: any) => {
        if (response?.R && response?.data) {
          try {
            const sleekNabuData = response.data;

            if (sleekNabuData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

              // Use window.location.href for Safari compatibility
              window.location.href = sleekNabuData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Sleek Nabu response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: any) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

}
