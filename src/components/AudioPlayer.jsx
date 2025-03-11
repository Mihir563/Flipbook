import {useRef, useState} from "react";


const AudioPlayer = ({ audioUrl }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
  
    // Function to play the audio
    const playAudio = () => {
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            console.error("Error playing audio:", error);
          });
      }
    };
  
    // Function to stop the audio
    const stopAudio = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset to start
        setIsPlaying(false);
      }
    };
  
    return (
      <div className="pointer-events-auto flex items-center  gap-2 bg-black/40 px-3 py-1 sm:px-4 sm:py-2 rounded-lg">
        <audio ref={audioRef} src={audioUrl} loop />
        {isPlaying ? (
          <button 
            onClick={stopAudio} 
            className="text-white justify-center hover:text-red-300 transition-colors flex items-center gap-1"
          >
            <span className="hidden sm:inline">■ Stop </span>
          </button>
        ) : (
          <button 
            onClick={playAudio} 
            className="text-white hover:text-green-300 transition-colors flex items-center gap-1"
          >
            <span className="hidden sm:inline">▶ Play Audio</span>
          </button>
        )}
      </div>
    );
  };

  export default AudioPlayer;