import { Component, EventEmitter, Output } from '@angular/core';
import { faAngleDoubleRight } from '../../../client/icons';

export interface ObjectCategory {
  id: string;
  name: string;
  icon: string;
  objects: PlaceableObject[];
}

export interface PlaceableObject {
  id: number;
  type: number;
  name: string;
  icon?: string;
}

@Component({
  selector: 'build-box',
  templateUrl: 'build-box.pug',
  styleUrls: ['build-box.scss']
})
export class BuildBox {
  @Output() objectSelected = new EventEmitter<PlaceableObject>();
  @Output() close = new EventEmitter<void>();
  
  readonly BuildIcon = faAngleDoubleRight;

  isOpen = false;
  selectedCategory: string = 'all';
  searchQuery = '';

  categories: ObjectCategory[] = [
    {
      id: 'all',
      name: 'All Objects',
      icon: '🏠',
      objects: []
    },
    {
      id: 'indoor',
      name: 'Indoor',
      icon: '🛋️',
      objects: [
        { id: 1, type: 1, name: 'Wooden Table' },
        { id: 2, type: 2, name: 'Chair' },
        { id: 3, type: 3, name: 'Bookshelf' },
        { id: 4, type: 4, name: 'Bed' },
        { id: 5, type: 5, name: 'Dresser' },
      ]
    },
    {
      id: 'wall',
      name: 'Wall Items',
      icon: '🖼️',
      objects: [
        { id: 6, type: 6, name: 'Window' },
        { id: 7, type: 7, name: 'Picture Frame' },
        { id: 8, type: 8, name: 'Clock' },
        { id: 9, type: 9, name: 'Shelf' },
      ]
    },
    {
      id: 'outdoor',
      name: 'Outdoor',
      icon: '🌳',
      objects: [
        { id: 10, type: 10, name: 'Bench' },
        { id: 11, type: 11, name: 'Fence' },
        { id: 12, type: 12, name: 'Torch' },
      ]
    },
    {
      id: 'food',
      name: 'Food & Storage',
      icon: '🍎',
      objects: [
        { id: 13, type: 13, name: 'Food Box' },
        { id: 14, type: 14, name: 'Barrel' },
        { id: 15, type: 15, name: 'Crate' },
      ]
    },
    {
      id: 'nature',
      name: 'Nature',
      icon: '🌿',
      objects: [
        { id: 16, type: 16, name: 'Plant' },
        { id: 17, type: 17, name: 'Tree' },
        { id: 18, type: 18, name: 'Flowers' },
      ]
    },
    {
      id: 'gardening',
      name: 'Gardening',
      icon: '🌸',
      objects: [
        { id: 19, type: 19, name: 'Flower Pot' },
        { id: 20, type: 20, name: 'Garden Bed' },
      ]
    },
    {
      id: 'tools',
      name: 'Tools & Smithing',
      icon: '⚒️',
      objects: [
        { id: 21, type: 21, name: 'Anvil' },
        { id: 22, type: 22, name: 'Forge' },
      ]
    },
    {
      id: 'lights',
      name: 'Lights',
      icon: '💡',
      objects: [
        { id: 23, type: 23, name: 'Lamp' },
        { id: 24, type: 24, name: 'Candle' },
        { id: 25, type: 25, name: 'Chandelier' },
      ]
    },
    {
      id: 'lanterns',
      name: 'Lantern posts',
      icon: '🏮',
      objects: [
        { id: 26, type: 26, name: 'Lantern Post' },
        { id: 27, type: 27, name: 'Street Lamp' },
      ]
    },
    {
      id: 'holiday',
      name: 'Holiday',
      icon: '🎁',
      objects: [
        { id: 28, type: 28, name: 'Gift Box' },
        { id: 29, type: 29, name: 'Decorations' },
      ]
    },
    {
      id: 'misc',
      name: 'Misc',
      icon: '📦',
      objects: [
        { id: 30, type: 30, name: 'Sign Post' },
        { id: 31, type: 31, name: 'Mailbox' },
      ]
    }
  ];

  constructor() {
    // Собираем все объекты в категорию "All Objects"
    // Используем map + reduce вместо flatMap для совместимости с ES2015
    const allObjects: PlaceableObject[] = [];
    this.categories.slice(1).forEach(cat => {
      allObjects.push(...cat.objects);
    });
    this.categories[0].objects = allObjects;
  }

  open() {
    this.isOpen = true;
    this.selectedCategory = 'all';
    this.searchQuery = '';
  }

  closeMenu() {
    this.isOpen = false;
    this.close.emit();
  }

  selectCategory(categoryId: string) {
    this.selectedCategory = categoryId;
  }

  selectObject(object: PlaceableObject) {
    this.objectSelected.emit(object);
  }

  onSearchChange(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
  }

  get currentObjects(): PlaceableObject[] {
    const category = this.categories.find(cat => cat.id === this.selectedCategory);
    let objects = category ? category.objects : [];

    if (this.searchQuery) {
      objects = objects.filter(obj => 
        obj.name.toLowerCase().includes(this.searchQuery)
      );
    }

    return objects;
  }
}