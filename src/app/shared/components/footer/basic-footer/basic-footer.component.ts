import { Component, Input } from '@angular/core';
import { Option } from '../../../../shared/interface/theme-option.interface';
import { Footer } from '../../../../shared/interface/theme.interface';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

@Component({
  selector: 'app-basic-footer',
  templateUrl: './basic-footer.component.html',
  styleUrls: ['./basic-footer.component.scss']
})
export class BasicFooterComponent {

  @Input() data: Option | null;
  @Input() footer: Footer;

  public active: { [key: string]: boolean } = {
    categories: false,
    useful_link: false,
    help_center: false
  };

  subscribeForm: FormGroup;
  submitted = false;
  subscribeSuccess = false;
  subscribeError = '';

  // List of valid email domains
  private validDomains = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'aol.com',
    'icloud.com',
    'mail.com',
    'protonmail.com',
    'zoho.com',
    'yandex.com',
    'gmx.com',
    'email.com'
  ];

  constructor(private fb: FormBuilder) {
    this.subscribeForm = this.fb.group({
      email: ['', [
        Validators.required, 
        Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'),
        this.validateEmailDomain.bind(this)
      ]]
    });
  }

  // Custom validator for email domains
  validateEmailDomain(control: AbstractControl): ValidationErrors | null {
    const email = control.value;
    if (!email || !email.includes('@')) {
      return null; // Let the pattern validator handle this
    }
    
    const domain = email.split('@')[1].toLowerCase();
    if (!this.validDomains.includes(domain)) {
      return { invalidDomain: true };
    }
    
    return null;
  }

  toggle(value: string){
    this.active[value] = !this.active[value];
  }

  onSubscribe() {
    this.submitted = true;
    this.subscribeSuccess = false;
    this.subscribeError = '';
    
    if (this.subscribeForm.valid) {      
      // Here you would typically call a service to handle the subscription
      // For demo purposes, we'll simulate a successful subscription
      setTimeout(() => {
        this.subscribeSuccess = true;
        this.subscribeForm.reset();
        this.submitted = false;
      }, 1000);
    }
  }

  get emailControl() {
    return this.subscribeForm.get('email');
  }
}
