import testGif from './img/twitter-clone-rec2.gif';
import bonfire from './img/game-store-rec4.gif';
import android from './img/android.gif';
import cvrec from './img/cvrec.gif';

const projects = [
  {
    id: 1,
    title: 'twitter clone',
    description: 'Fullstack app created with React and Firebase.',
    imageUrl: testGif,
    link: 'https://twitter-clone-project-quack.web.app/homepage'
  },
  {
    id: 2,
    title: 'game store',
    description: 'React store page showcasing the latest game deals, sourced from the CheapShark API.',
    imageUrl: bonfire,
    link: 'https://kayo-b.github.io/game-store-page/'
  },
  { 
    id: 3, 
    title: 'card game', 
    description: 'Simple card game created with React.', 
    imageUrl: android,
    link: 'https://kayo-b.github.io/memory-card-game/'
  }, 
  { 
    id: 4,
    title: 'CV template',
    description: 'CV template created with React.',
    imageUrl: cvrec, 
    link: 'https://kayo-b.github.io/cv-app/'
  }
];
export default projects;