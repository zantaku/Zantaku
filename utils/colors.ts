export const getRatingColor = (score: number) => {
  if (!score) return 'transparent';
  // Always convert to percentage for color calculation
  const percentage = score > 10 ? score : score * 10;
  
  if (percentage >= 85) return '#4CAF50';      // Bright green for excellent (8.5+)
  if (percentage >= 70) return '#8BC34A';      // Light green for very good (7.0-8.4)
  if (percentage >= 60) return '#CDDC39';      // Lime yellow for good (6.0-6.9)
  if (percentage >= 50) return '#FFC107';      // Amber for average (5.0-5.9)
  if (percentage >= 35) return '#FF9800';      // Orange for below average (3.5-4.9)
  return '#F44336';                            // Red for poor (<3.5)
};

// Format score consistently across the app
export const formatScore = (score: number | null | undefined) => {
  if (!score) return 'N/A';  // Return 'N/A' for no score
  // If score is in percentage format (0-100), convert to decimal (0-10)
  const decimalScore = score > 10 ? score / 10 : score;
  return decimalScore.toFixed(1);
};

// For consistency in status colors
export const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'CURRENT':
    case 'RELEASING':
      return '#02A9FF';    // Blue
    case 'COMPLETED':
    case 'FINISHED':
      return '#4CAF50';    // Green
    case 'PLANNING':
      return '#FFC107';    // Amber
    case 'DROPPED':
      return '#F44336';    // Red
    case 'PAUSED':
    case 'HIATUS':
      return '#FF9800';    // Orange
    default:
      return '#666666';    // Gray
  }
}; 