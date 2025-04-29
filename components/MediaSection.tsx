interface MediaSectionProps {
  title: string;
  items: MediaItem[];
  onItemPress: (item: MediaItem) => void;
}

// Then in your render method, pass the onPress handler to your media items
<MediaItem 
  item={item}
  onPress={() => onItemPress(item)}
/> 